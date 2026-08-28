# Maxylogy TikTok Panel

Стартовый прототип панели для создания и публикации коротких видео в TikTok.

## Что уже есть
- панель «Идея → Сценарий → Ролик → Публикация»;
- кнопка подключения TikTok;
- OAuth callback-заготовка;
- серверные endpoints для Creator Info и Direct Post;
- секреты хранятся только на сервере через `.env`.

## Важно
Перед реальной публикацией нужно:
1. развернуть приложение на HTTPS-домене;
2. указать этот Redirect URI в TikTok Developer Portal;
3. использовать Client Key/Secret только на сервере;
4. получить одобрение `video.publish` через App Review.

## Запуск
Требуется Node.js 18+.

```bash
npm install
cp .env.example .env
npm start
```

Откройте `http://localhost:3000`.

Для TikTok OAuth в production используйте HTTPS-домен и тот же Redirect URI, который указан в Developer Portal.
