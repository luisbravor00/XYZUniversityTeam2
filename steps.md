# Update and Upgrade the System
sudo apt update
sudo apt upgrade -y


# Install NodeJS
sudo apt install -y nodejs build-essential
sudo apt install -y nginx


# Setup the app
cd /home/ubuntu

git clone https://github.com/luisbravor00/XYZUniversityTeam2.git

cd /home/ubuntu/XYZUniversityTeam2

npm install

sudo rm /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/myapp << 'EOF'
server {
    listen 80;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/

sudo nginx -t

sudo systemctl restart nginx


# Start the WebServer as a Service
sudo npm install -g pm2

cd /home/ubuntu/XYZUniversityTeam2
pm2 start server.js --name xyzuniversity

pm2 startup systemd

pm2 save