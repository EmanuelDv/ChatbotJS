# Usar una imagen base de Node.js (versión que usaste en Render)
FROM node:22.14.0

# Instalar dependencias del sistema para Puppeteer
RUN apt-get update && apt-get install -y \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libxcursor1 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libu2f-udev \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json (si existe)
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm install

# Copiar el resto de tu código
COPY . .

# Comando para iniciar el bot
CMD ["node", "index.js"]