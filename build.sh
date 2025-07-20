#!/bin/bash

# Update package list dan install build tools
apt-get update
apt-get install -y build-essential python3-dev

# Lanjutkan dengan proses instalasi requirements Python
pip install -r requirements.txt