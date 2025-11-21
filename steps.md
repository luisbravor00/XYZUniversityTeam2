#!/bin/bash
sudo su

# Update system
sudo apt update -y
sudo apt upgrade -y

# Install required packages
sudo apt install -y git nginx build-essential nodejs npm mariadb-client-core

# Switch to ubuntu user home
cd /home/ubuntu

# Clone repository
sudo git clone https://github.com/luisbravor00/XYZUniversityTeam2.git
cd XYZUniversityTeam2

# Install dependencies as ubuntu user
sudo npm install
sudo npm install mysql2

# Write .env
sudo tee /home/ubuntu/XYZUniversityTeam2/.env > /dev/null << 'EOF'
RDS_HOSTNAME=
RDS_PORT=3306
RDS_USERNAME=admin
RDS_PASSWORD=Mypassw0rd123
RDS_DB_NAME=students_db
PORT=3000
NODE_ENV=production
EOF

sudo chmod 600 /home/ubuntu/XYZUniversityTeam2/.env

# Configure Nginx reverse proxy
sudo rm -f /etc/nginx/sites-enabled/default

sudo tee /etc/nginx/sites-available/myapp > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Starting the service
echo "Initializing the server in the background..."
cd /home/ubuntu/XYZUniversityTeam2
nohup node server.js > server_starting.log 2>&1 &