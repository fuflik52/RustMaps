# 🎯 RustMaps Parser

Высокопроизводительный парсер карт с сайта rustmaps.ru, написанный на TypeScript. Автоматически извлекает все карты и скачивает их с максимальной эффективностью.

## ✨ Возможности

- 🚀 **Асинхронная обработка** - параллельное скачивание до 50 карт одновременно
- 🎭 **Умный браузер** - использует Puppeteer для обхода JavaScript-защиты
- 🔄 **Система повторов** - автоматические повторные попытки при ошибках
- 📊 **Прогресс в реальном времени** - детальная статистика скачивания
- 📝 **Манифест карт** - JSON-файл с метаданными всех карт
- 🎨 **Красивые логи** - цветной вывод с прогресс-барами
- ⚡ **Оптимизация ресурсов** - блокировка ненужных CSS/изображений
- 💾 **Умное именование** - автоматическая генерация имен файлов

## 🛠 Установка

### Предварительные требования

- Node.js 18.0.0 или выше
- npm или yarn

### Быстрый старт

```bash
# Клонируем репозиторий
git clone https://github.com/your-username/rustmaps-parser.git
cd rustmaps-parser

# Устанавливаем зависимости
npm install

# Собираем проект
npm run build

# Запускаем веб-интерфейс (рекомендуется)
npm run web

# Или запускаем парсер в CLI режиме
npm start scan
```

### Установка через npm (планируется)

```bash
npm install -g rustmaps-parser
rustmaps-parser --help
```

## 🚀 Использование

### Веб-интерфейс (Новинка!)

```bash
# Запуск веб-браузера карт
npm run web

# Запуск на другом порту
npm start web --port 8080
```

Откройте браузер по адресу `http://localhost:3000` и наслаждайтесь удобным интерфейсом!

**Возможности веб-интерфейса:**
- 🖥️ Красивый браузер всех карт в виде карточек
- 🔍 Мгновенный поиск по названию, описанию и тегам
- 📄 Детальная информация о каждой карте
- ⬇️ Прямые ссылки на скачивание файлов
- 🚀 Интеграция с Facepunch API
- 📊 Статистика и пагинация
- 📱 Адаптивный дизайн для мобильных устройств

### Командная строка

```bash
# Скачать все карты в папку ./downloads
npm start scan

# Скачать с пользовательскими настройками
npm start scan -- --output ./my-maps
```

### Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run web` | Запуск веб-интерфейса (рекомендуется) |
| `npm start scan` | Разовое сканирование и скачивание |
| `npm start monitor` | Непрерывный мониторинг |
| `npm start stats` | Показать статистику кеша |
| `npm start reset` | Сбросить кеш загрузок |
| `npm start test-facepunch` | Тест Facepunch API |

### Параметры командной строки

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `-o, --output <path>` | Папка для сохранения | `./output` |
| `-p, --port <port>` | Порт для веб-сервера | `3000` |
| `-i, --interval <min>` | Интервал мониторинга (минуты) | `60` |

### Примеры использования

```bash
# Запуск веб-интерфейса (основной способ)
npm run web

# Запуск веб-интерфейса на порту 8080
npm start web --port 8080

# CLI: разовое сканирование
npm start scan

# CLI: непрерывный мониторинг каждый час
npm start monitor --interval 60

# CLI: просмотр статистики
npm start stats

# CLI: сброс кеша и пересканирование
npm start reset
npm start scan
```

## 📁 Структура проекта

```
rustmaps-parser/
├── src/                     # Исходный код
│   ├── core/               # Ядро системы
│   │   └── browser.ts      # Управление браузером
│   ├── parsers/            # Парсеры
│   │   └── mapParser.ts    # Парсинг карт
│   ├── downloader/         # Скачивание
│   │   └── fileDownloader.ts
│   ├── utils/              # Утилиты
│   │   └── logger.ts       # Система логирования
│   ├── config/             # Конфигурация
│   │   └── defaults.ts     # Настройки по умолчанию
│   ├── types/              # TypeScript типы
│   │   └── index.ts
│   └── index.ts            # Точка входа
├── dist/                   # Скомпилированный код
├── downloads/              # Скачанные карты (по умолчанию)
└── package.json
```

## 🔧 Разработка

### Настройка окружения

```bash
# Установка зависимостей
npm install

# Разработка с автоперезагрузкой
npm run dev

# Сборка проекта
npm run build

# Линтинг кода
npm run lint

# Форматирование кода
npm run format

# Очистка кеша
npm run clean
```

### Архитектура

Парсер построен на модульной архитектуре:

1. **BrowserManager** - управление Puppeteer, оптимизация производительности
2. **MapParser** - извлечение данных карт, обход пагинации
3. **FileDownloader** - асинхронное скачивание с контролем ошибок
4. **Logger** - красивый вывод с прогресс-барами
5. **CLI** - удобный интерфейс командной строки

## 📊 Производительность

### Тесты производительности

- **Скорость парсинга**: ~100 карт/минута
- **Скорость скачивания**: зависит от размера файлов и настройки concurrency
- **Потребление памяти**: ~150MB при concurrency=10
- **Обработка ошибок**: автоматические повторы с экспоненциальной задержкой

### Оптимизация

- Блокировка CSS/изображений для ускорения загрузки страниц
- Пул соединений для эффективного использования ресурсов
- Умное кеширование для предотвращения повторной обработки
- Graceful shutdown для корректного завершения операций

## 📋 Формат выходных данных

### Структура папки скачивания

```
downloads/
├── maps_manifest.json       # Метаданные всех карт
├── 12345_Custom_Map.map     # Файлы карт
├── 12346_Awesome_Map.zip
└── ...
```

### Формат манифеста

```json
{
  "created": "2024-01-15T10:30:00.000Z",
  "total": 1500,
  "maps": [
    {
      "mid": "12345",
      "title": "Custom Map",
      "description": "Amazing custom map",
      "url": "https://rustmaps.ru/index.php?mode=map&mid=12345",
      "downloadUrl": "https://rustmaps.ru/download.php?id=12345",
      "hasDownloadUrl": true
    }
  ]
}
```

## ⚠️ Важные замечания

### Этика использования

- Используйте разумные настройки concurrency (рекомендуется ≤20)
- Не злоупотребляйте частотой запросов
- Соблюдайте условия использования сайта
- Используйте скачанные карты только в личных целях

### Обработка ошибок

Парсер автоматически обрабатывает:
- Сетевые ошибки и таймауты
- Ошибки JavaScript на страницах
- Недоступные файлы для скачивания
- Проблемы с файловой системой

## 🐛 Известные ограничения

- Некоторые карты могут быть недоступны для скачивания
- Сайт может блокировать слишком частые запросы
- Требуется актуальная версия Chrome/Chromium для Puppeteer

## 🤝 Участие в разработке

1. Fork репозитория
2. Создайте feature branch: `git checkout -b feature/amazing-feature`
3. Commit изменения: `git commit -m 'Add amazing feature'`
4. Push в branch: `git push origin feature/amazing-feature`
5. Откройте Pull Request

## 📄 Лицензия

MIT License - подробности в файле [LICENSE](LICENSE)

## 🔗 Связанные проекты

- [rustmaps.py](https://pypi.org/project/rustmaps.py/) - Python wrapper для rustmaps.com
- [huntmap-parser](https://github.com/interlark/huntmap-parser) - Парсер huntmap.ru

## ⭐ Поддержите проект

Если проект оказался полезным, поставьте звездочку ⭐ на GitHub!

---

**Создано с ❤️ для сообщества Rust**

# RustMaps Parser

🗺️ Automated parser for rustmaps.ru that downloads Rust maps, uploads them to Facepunch API, and sends Discord notifications.

## Features

- 🔍 **Stream Processing** - Parses, downloads, uploads, and notifies in real-time
- 📥 **Smart Caching** - Tracks downloaded files to avoid duplicates
- 🚀 **Facepunch Integration** - Uploads maps to official Facepunch API
- 📤 **Discord Notifications** - Sends notifications with Facepunch URLs only
- 🌐 **Russian to Latin** - Transliterates Russian filenames for compatibility
- 🤖 **GitHub Actions** - Automated parsing every 6 hours

## Installation

```bash
# Clone repository
git clone <your-repo-url>
cd rustmaps-parser

# Install dependencies
npm install

# Build project
npm run build
```

## Configuration

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# Discord webhook URL (required for notifications)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL

# Enable Facepunch API uploads (required)
FACEPUNCH_UPLOAD_ENABLED=true

# Optional: Delete local files after Facepunch upload
DELETE_LOCAL_AFTER_UPLOAD=false

# Optional network configuration
# Base URL override for rustmaps
# RUSTMAPS_BASE_URL=https://rustmaps.ru
# Force HTTP fallback even if HTTPS fails preflight
# FORCE_HTTP_FALLBACK=false
# Network timeout in ms (shared across axios and Puppeteer default)
# NETWORK_TIMEOUT_MS=15000
# Concurrency and retries
# CONCURRENCY=3
# RETRY_ATTEMPTS=2
# Headless mode for Puppeteer (true/false)
# HEADLESS=true
# Custom user agent for both browser and HTTP requests
# USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36

# Proxy configuration (auto-detected via proxy-agent)
# HTTP_PROXY=http://user:pass@host:port
# HTTPS_PROXY=http://user:pass@host:port
# ALL_PROXY=socks5://host:port
# NO_PROXY=localhost,127.0.0.1

# Optional: force rustmaps.ru IPv4 mapping for browser (host-resolver-rules)
# RUSTMAPS_IPV4=185.185.124.28
```

### GitHub Actions Setup

1. **Add Repository Secrets:**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Add secret: `DISCORD_WEBHOOK_URL` with your Discord webhook URL

2. **Enable Actions:**
   - Go to Actions tab and enable workflows
   - The parser will run automatically every 6 hours

3. **Manual Trigger:**
   - Go to Actions → Parse RustMaps → Run workflow

## Usage

### Local Commands

```bash
# Single scan
npm start scan

# Continuous monitoring (every 60 minutes)
npm start monitor --interval 60

# Show cache statistics
npm start stats

# Reset download cache
npm start reset

# Test Facepunch API upload
npm start test-facepunch
```

### GitHub Actions Workflow

The automated workflow:
1. 🔍 Parses rustmaps.ru for new maps
2. 📥 Downloads .map files (not committed to Git)
3. 🚀 Uploads to Facepunch API
4. 📤 Sends Discord notifications with Facepunch URLs
5. 💾 Updates and commits `rustmaps-cache.json`

## File Structure

```
rustmaps-parser/
├── src/                    # Source code
├── output/                 # Output directory
│   ├── rustmaps-cache.json # Cache file (tracked in Git)
│   └── *.map              # Map files (ignored by Git)
├── .github/workflows/      # GitHub Actions
└── dist/                   # Built JavaScript
```

## Cache System

- **Tracked in Git:** `output/rustmaps-cache.json`
- **Ignored by Git:** `output/*.map` files
- **Purpose:** Prevents re-downloading same files across runs

## Discord Integration

- Only sends notifications for maps with Facepunch URLs
- Includes map title, ID, tags, and Facepunch download link
- Sends scan summaries with statistics

## Facepunch API

- Uploads .map files to official Facepunch API
- Generates safe filenames with Russian transliteration
- Provides reliable download URLs for Discord

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Troubleshooting

### GitHub Actions Issues

1. **Workflow not running:**
   - Check if Actions are enabled in repository settings
   - Verify cron schedule syntax

2. **Discord notifications not working:**
   - Ensure `DISCORD_WEBHOOK_URL` secret is set correctly
   - Test webhook URL manually

3. **Facepunch uploads failing:**
   - Check if `FACEPUNCH_UPLOAD_ENABLED=true` is set
   - Verify .map files are being generated

### Local Issues

1. **Browser errors:**
   ```bash
   # Install Chromium dependencies (Ubuntu/Debian)
   sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0
   ```

2. **Permission errors:**
   ```bash
   # Fix output directory permissions
   chmod 755 output/
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details. 