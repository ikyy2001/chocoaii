import os
import json
import click
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
import google.generativeai as genai
import openai
from datetime import datetime
from functools import wraps

# Muat environment variables
load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'ganti-dengan-kunci-rahasia-yang-kuat')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message_category = 'info'

# Konfigurasi API
try:
    if not os.getenv('GEMINI_API_KEY'): print("PERINGATAN: GEMINI_API_KEY tidak ditemukan di file .env")
    genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
    openai.api_key = os.getenv('OPENAI_API_KEY')
except Exception as e:
    print(f"Peringatan: Gagal mengonfigurasi API Key. Error: {e}")

# === MODEL DATABASE ===
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    level = db.Column(db.String(50), default='Bronze')
    chats = db.relationship('ChatHistory', backref='author', lazy=True, cascade="all, delete-orphan")

class ChatHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    model = db.Column(db.String(50), nullable=False)
    conversation = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    is_favorite = db.Column(db.Boolean, default=False)

class CustomQA(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.String(255), unique=True, nullable=False)
    answer = db.Column(db.Text, nullable=False)

class EmojiReaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    reaction = db.Column(db.String(10), nullable=False)
    response_text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def admin_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            flash("Anda tidak memiliki akses ke halaman ini.", "danger"); return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

# === HALAMAN & ROUTE ===
@app.route('/')
def index(): return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated: return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form['username']; password = request.form['password']
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        if User.query.filter_by(username=username).first():
            flash('Username sudah terdaftar.', 'danger'); return redirect(url_for('register'))
        user = User(username=username, password=hashed_password)
        db.session.add(user); db.session.commit()
        flash('Akun berhasil dibuat! Silakan login.', 'success'); return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated: return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form['username']; password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user, remember=True)
            return redirect(request.args.get('next') or url_for('index'))
        else: flash('Login gagal. Periksa kembali username dan password.', 'danger')
    return render_template('login.html')

@app.route('/logout')
def logout(): logout_user(); return redirect(url_for('index'))

@app.route('/credit')
def credit(): return render_template('credit.html')

@app.route('/chat')
@login_required
def chat_page():
    history = ChatHistory.query.filter_by(user_id=current_user.id).order_by(ChatHistory.timestamp.desc()).all()
    formatted_history = [{'id': c.id, 'title': (json.loads(c.conversation)[0]['content'][:50] + '...') if c.conversation and json.loads(c.conversation) else 'Percakapan', 'is_favorite': c.is_favorite} for c in history]
    return render_template('chat.html', history=formatted_history, user_level=current_user.level)

@app.route('/api/chat', methods=['POST'])
@login_required
def api_chat():
    data = request.json
    prompt = data.get('prompt'); model_choice = data.get('model', 'choco'); version = data.get('version'); conversation_history = data.get('history', [])
    response_text = ""; model_used = ""
    custom_answer = CustomQA.query.filter(CustomQA.question.ilike(f"%{prompt}%")).first()
    if custom_answer:
        response_text = custom_answer.answer; model_used = "Choco AI (Custom)"
    else:
        try:
            if model_choice == 'choco':
                model_used = "Choco AI (Gemini)"; gemini_model = genai.GenerativeModel('gemini-1.5-flash')
                response = gemini_model.generate_content(prompt); response_text = response.text
            elif model_choice == 'gemini':
                model_used = f"Gemini ({version})"; model = genai.GenerativeModel(version)
                response = model.generate_content(prompt); response_text = response.text
            elif model_choice == 'chatgpt':
                model_used = f"ChatGPT ({version})"
                response = openai.chat.completions.create(model=version, messages=[{"role": "user", "content": prompt}])
                response_text = response.choices[0].message.content
            else: return jsonify({'error': 'Model tidak valid'}), 400
        except Exception as e:
            app.logger.error(f"API Error: {str(e)}"); return jsonify({'error': "Terjadi kesalahan pada AI. Pastikan API Key Anda valid."}), 500
    new_conversation = conversation_history + [{'role': 'user', 'content': prompt}, {'role': 'assistant', 'content': response_text}]
    chat_record = ChatHistory(user_id=current_user.id, model=model_used, conversation=json.dumps(new_conversation))
    db.session.add(chat_record); db.session.commit()
    return jsonify({'response': response_text, 'chat_id': chat_record.id})

@app.route('/api/chat/history/<int:chat_id>')
@login_required
def get_chat_history(chat_id): return jsonify(json.loads(ChatHistory.query.filter_by(id=chat_id, user_id=current_user.id).first_or_404().conversation))

@app.route('/api/chat/delete/<int:chat_id>', methods=['POST'])
@login_required
def delete_chat(chat_id):
    db.session.delete(ChatHistory.query.filter_by(id=chat_id, user_id=current_user.id).first_or_404()); db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/feedback/emoji', methods=['POST'])
@login_required
def submit_emoji_reaction():
    data = request.json
    db.session.add(EmojiReaction(chat_id=data['chat_id'], user_id=current_user.id, reaction=data['emoji'], response_text=data['response_text'])); db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/admin')
@admin_required
def admin_panel():
    return render_template('admin.html', total_users=User.query.count(), total_chats=ChatHistory.query.count(), qnas=CustomQA.query.all(), emoji_reactions=EmojiReaction.query.order_by(EmojiReaction.timestamp.desc()).limit(20).all())

@app.route('/admin/users')
@admin_required
def admin_users(): return render_template('admin_users.html', users=User.query.order_by(User.id).all())

@app.route('/admin/user/level/<int:user_id>', methods=['POST'])
@admin_required
def edit_user_level(user_id):
    user = User.query.get_or_404(user_id)
    user.level = request.form['level']; db.session.commit()
    flash(f'Level pengguna {user.username} diubah menjadi {user.level}.', 'success')
    return redirect(url_for('admin_users'))

@app.route('/admin/user/grant/<int:user_id>', methods=['POST'])
@admin_required
def grant_admin(user_id):
    user = User.query.get_or_404(user_id)
    user.is_admin = True; db.session.commit()
    flash(f'User {user.username} sekarang adalah admin.', 'success')
    return redirect(url_for('admin_users'))

@app.route('/admin/user/revoke/<int:user_id>', methods=['POST'])
@admin_required
def revoke_admin(user_id):
    if user_id == current_user.id: flash('Anda tidak dapat mencabut status admin diri sendiri.', 'danger')
    else:
        user = User.query.get_or_404(user_id)
        user.is_admin = False; db.session.commit()
        flash(f'Status admin untuk user {user.username} telah dicabut.', 'success')
    return redirect(url_for('admin_users'))

@app.route('/admin/qna/add', methods=['POST'])
@admin_required
def add_qna():
    question = request.form['question']; answer = request.form['answer']
    if question and answer:
        db.session.add(CustomQA(question=question, answer=answer)); db.session.commit()
        flash('Custom Q&A berhasil ditambahkan!', 'success')
    else: flash('Pertanyaan dan Jawaban tidak boleh kosong.', 'danger')
    return redirect(url_for('admin_panel'))

@app.route('/admin/qna/delete/<int:qna_id>', methods=['POST'])
@admin_required
def delete_qna(qna_id):
    db.session.delete(CustomQA.query.get_or_404(qna_id)); db.session.commit()
    flash('Custom Q&A berhasil dihapus.', 'success'); return redirect(url_for('admin_panel'))

@app.cli.command("change-password")
@click.argument("username")
@click.argument("new_password")
def change_password(username, new_password):
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        if user:
            user.password = bcrypt.generate_password_hash(new_password).decode('utf-8'); db.session.commit()
            print(f"Password untuk user '{username}' telah berhasil diubah.")
        else: print(f"User dengan username '{username}' tidak ditemukan.")

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(username='admin').first():
            print("Membuat akun admin default...")
            db.session.add(User(username='admin', password=bcrypt.generate_password_hash('admin').decode('utf-8'), is_admin=True, level='Royal')); db.session.commit()
            print("Akun admin dibuat dengan username: admin, password: admin")
    app.run(debug=True, port=5001)
