# 온프레미스 서버 배포 가이드

자체 서버(Ubuntu 등 Linux)에 moim-tailboard를 배포하는 절차입니다.

---

## 1. 서버 요구사항

- **OS**: Ubuntu 22.04 LTS 등 Linux (권장)
- **Node.js**: 18.x (`node -v`)
- **MySQL**: 8.0 권장 (같은 서버 또는 별도 서버)
- **메모리**: 최소 512MB, 권장 1GB 이상

---

## 2. MySQL 준비

### 같은 서버에 MySQL 설치 시

```bash
sudo apt update && sudo apt install -y mysql-server
sudo mysql_secure_installation
sudo mysql -e "CREATE DATABASE moim_tailboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'moim'@'localhost' IDENTIFIED BY '비밀번호';"
sudo mysql -e "GRANT ALL ON moim_tailboard.* TO 'moim'@'localhost';"
```

스키마 적용:

```bash
mysql -u moim -p moim_tailboard < /path/to/schema.sql
```

이 경우 `.env`에서는 **DB_SSL_CA / DB_SSL_CA_CONTENT 없이** 사용하면 됩니다.

- `DB_HOST=localhost` 또는 `127.0.0.1`
- `DB_PORT=3306`
- `DB_USER=moim`, `DB_PASSWORD=...`, `DB_NAME=moim_tailboard`

### 외부 MySQL(Aiven 등) 사용 시

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` 설정
- SSL 필요 시 **서버에 `ca.pem` 업로드** 후 `DB_SSL_CA=./ca.pem` 또는 PEM 내용을 `DB_SSL_CA_CONTENT`로 설정

---

## 3. 앱 배포

### 3.1 코드 올리기

```bash
# 예: 서버에 클론 또는 rsync/scp로 backend 복사
git clone <저장소> /opt/moim-tailboard
# 또는
rsync -avz --exclude node_modules ./backend user@서버:/opt/moim-tailboard/
```

### 3.2 환경 변수

`/opt/moim-tailboard/backend/.env` (또는 앱 디렉터리)에 다음을 설정합니다.

| 변수 | 예시 (온프레미스) |
|------|-------------------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (기본값이므로 생략 가능) |
| `DB_HOST` | `localhost` 또는 DB 서버 주소 |
| `DB_PORT` | `3306` |
| `DB_USER` | `moim` |
| `DB_PASSWORD` | (실제 비밀번호) |
| `DB_NAME` | `moim_tailboard` |
| `DB_SSL_CA` | 외부 DB+SSL일 때만 (예: `./ca.pem`) |
| `TELEGRAM_BOT_TOKEN` | BotFather 토큰 |
| `TELEGRAM_BOT_NAME` | 봇 사용자명 |
| `APP_URL` | **https://실제도메인** (예: `https://tailboard.yourchurch.org`) |
| `JWT_SECRET` | 32자 이상 랜덤 문자열 |

`.env`와 `ca.pem`은 Git/배포 스크립트에서 제외하고, 서버에만 둡니다.

### 3.3 설치 및 실행

```bash
cd /opt/moim-tailboard/backend
npm ci --omit=dev
node src/server.js
```

동작 확인 후 **Ctrl+C**로 중지하고, 아래처럼 프로세스 매니저로 상시 실행합니다.

---

## 4. 프로세스 매니저 (PM2)

서버 재부팅 후에도 앱이 자동으로 떠 있도록 PM2 사용을 권장합니다.

```bash
sudo npm install -g pm2
cd /opt/moim-tailboard/backend
pm2 start src/server.js --name moim-tailboard
pm2 save
pm2 startup   # 출력된 명령을 그대로 실행해 부팅 시 자동 시작 등록
```

- 로그: `pm2 logs moim-tailboard`
- 재시작: `pm2 restart moim-tailboard`

---

## 5. 리버스 프록시 + HTTPS (Nginx)

외부에서는 80/443만 열고, 앱은 내부에서만 3000 포트로 받습니다.

### 5.1 Nginx 설치

```bash
sudo apt install -y nginx
```

### 5.2 사이트 설정

`/etc/nginx/sites-available/moim-tailboard` (또는 `default` 수정):

```nginx
server {
    listen 80;
    server_name tailboard.yourchurch.org;   # 실제 도메인으로 변경

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/moim-tailboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5.3 HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tailboard.yourchurch.org
```

이후 `APP_URL`은 **https://tailboard.yourchurch.org** 로 맞춰 두면 됩니다.

---

## 6. 텔레그램 봇 설정

- BotFather에서 **도메인 연결**: `/setdomain` → `tailboard.yourchurch.org` (https 없이)
- **메뉴 버튼** URL을 실제 도메인·테넌트에 맞게 설정 (예: `https://tailboard.yourchurch.org/t/테넌트slug/events`)

---

## 7. 방화벽

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
```

3000 포트는 외부에 열지 않습니다 (Nginx가 대신 받음).

---

## 8. 체크리스트

- [ ] MySQL 설치 및 `schema.sql` 적용, tenant·admin 최소 1건
- [ ] `backend/.env` 작성 (APP_URL은 **https** 포함)
- [ ] `npm ci --omit=dev` 후 `node src/server.js` 로 동작 확인
- [ ] PM2로 상시 실행 및 `pm2 startup`
- [ ] Nginx 리버스 프록시 + HTTPS (Let's Encrypt)
- [ ] BotFather `/setdomain` 및 메뉴 버튼 URL을 실제 도메인으로 변경
- [ ] 브라우저에서 `APP_URL` 접속 → 로그인·이벤트 목록·참여 동작 확인

추가로 **OPERATION_TODO.md** 의 “배포 인프라”, “보안”, “배포 후 확인” 항목도 참고하면 됩니다.
