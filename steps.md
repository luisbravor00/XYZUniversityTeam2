#!/bin/bash
set -e

# Update system
apt update -y
apt upgrade -y

# Install required packages
apt install -y git nginx build-essential

# Install Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs

# Switch to ubuntu user home
cd /home/ubuntu

# Clone repository
sudo -u ubuntu git clone https://github.com/luisbravor00/XYZUniversityTeam2.git
cd XYZUniversityTeam2

# Install dependencies as ubuntu user
sudo -u ubuntu npm install

# Write .env
sudo -u ubuntu tee /home/ubuntu/XYZUniversityTeam2/.env > /dev/null << 'EOF'
RDS_HOSTNAME=your-rds-endpoint.rds.amazonaws.com
RDS_PORT=3306
RDS_USERNAME=
RDS_PASSWORD=
RDS_DB_NAME=students_db
PORT=3000
NODE_ENV=production
EOF

chmod 600 /home/ubuntu/XYZUniversityTeam2/.env

# Configure Nginx reverse proxy
rm -f /etc/nginx/sites-enabled/default

tee /etc/nginx/sites-available/myapp > /dev/null << 'EOF'
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

ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Install PM2 globally
npm install -g pm2

# Start the Node app as ubuntu user
sudo -u ubuntu pm2 start /home/ubuntu/XYZUniversityTeam2/server.js --name xyzuniversity

# Enable PM2 startup
sudo -u ubuntu pm2 startup systemd -u ubuntu --hp /home/ubuntu
sudo -u ubuntu pm2 save
