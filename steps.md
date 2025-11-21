#!/bin/bash
# EC2 Instance Setup Script for XYZ University (RDS MariaDB Version)

# Update and Upgrade the System
sudo apt update
sudo apt upgrade -y

# Install NodeJS and Nginx
sudo apt install -y nodejs build-essential nginx

# Setup the app
cd /home/ubuntu
git clone https://github.com/luisbravor00/XYZUniversityTeam2.git
cd /home/ubuntu/XYZUniversityTeam2
npm install

# Create .env file with RDS credentials
# IMPORTANT: Replace these values with your actual RDS information
cat > .env << 'EOF'
# RDS MariaDB Configuration
RDS_HOSTNAME=your-rds-endpoint.rds.amazonaws.com
RDS_PORT=3306
RDS_USERNAME=admin
RDS_PASSWORD=Mypassw0rd123
RDS_DB_NAME=students_db

# Application Port
PORT=3000

# Node Environment
NODE_ENV=production
EOF

# Secure the .env file (important for credentials)
chmod 600 .env

# Configure Nginx reverse proxy
sudo rm /etc/nginx/sites-enabled/default
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
        
        # Timeouts (adjust if needed for large imports)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Start the WebServer as a Service with PM2
sudo npm install -g pm2
cd /home/ubuntu/XYZUniversityTeam2

# Start application with PM2 (will automatically load .env file)
pm2 start server.js --name xyzuniversity --env production

# Setup PM2 to start on system boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save

# Display PM2 status
pm2 status

# Restart the app if you make changes
pm2 restart xyzuniversity