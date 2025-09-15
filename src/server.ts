import express from 'express';
import { BrowserManager } from './core/browser';
import { MapParser } from './parsers/mapParser';
import { CacheManager } from './core/cacheManager';
import { DEFAULT_CONFIG } from './config/defaults';
import { logger } from './utils/logger';
import { MapData } from './types';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Глобальные переменные
let browserManager: BrowserManager | null = null;
let mapParser: MapParser | null = null;
let cacheManager: CacheManager | null = null;
let allMaps: MapData[] = [];
let isInitialized = false;

// Инициализация компонентов
async function initializeComponents() {
  if (isInitialized) return;
  
  try {
    logger.info('🔧 Инициализация веб-сервера...');
    
    // Инициализируем кеш-менеджер (не требует браузера)
    logger.info('💾 Инициализация кеш-менеджера...');
    cacheManager = new CacheManager('./output');
    await cacheManager.initialize();
    logger.success('✅ Кеш-менеджер инициализирован');
    
    // Пробуем инициализировать браузер (может не работать в production)
    try {
      logger.info('🌐 Инициализация браузера...');
      browserManager = new BrowserManager();
      await browserManager.initialize();
      logger.success('✅ Браузер инициализирован');
      
      // Создаем парсер только если браузер инициализирован
      logger.info('🔍 Создание парсера...');
      mapParser = new MapParser(browserManager, DEFAULT_CONFIG.baseUrl);
      logger.success('✅ Парсер создан');
    } catch (browserError) {
      logger.warn('⚠️ Браузер не может быть инициализирован (режим только кеша):', browserError as Error);
      logger.info('📖 Веб-интерфейс будет работать только с существующими данными кеша');
    }
    
    isInitialized = true;
    logger.success('✅ Компоненты инициализированы');
    
  } catch (error) {
    logger.error('❌ Критическая ошибка инициализации:', error as Error);
    if ((error as Error).stack) {
      logger.error('Stack trace: ' + (error as Error).stack);
    }
    throw error;
  }
}

// Функция загрузки карт из кеша или парсинга
async function loadMaps(): Promise<MapData[]> {
  if (!cacheManager) {
    throw new Error('Кеш-менеджер не инициализирован');
  }

  try {
    // Сначала пробуем загрузить из кеша
    const cachedMaps = cacheManager.getAllDiscoveredMaps();
    
    if (cachedMaps.length > 0) {
      logger.info(`📦 Загружено ${cachedMaps.length} карт из кеша`);
      return cachedMaps;
    }
    
    // Если кеш пуст и парсер доступен, парсим заново
    if (mapParser) {
      logger.info('🔍 Парсинг карт с rustmaps.ru...');
      const newMaps = await mapParser.parseMainPage();
      
      if (newMaps.length > 0) {
        await cacheManager.updateDiscoveredMaps(newMaps);
        logger.success(`✅ Спарсено ${newMaps.length} карт`);
      }
      
      return newMaps;
    } else {
      logger.warn('⚠️ Парсер недоступен, кеш пуст. Возвращаем пустой список.');
      return [];
    }
    
  } catch (error) {
    logger.error('❌ Ошибка загрузки карт:', error as Error);
    return [];
  }
}

// API Routes

// Проверка состояния сервера
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    initialized: isInitialized,
    components: {
      cacheManager: !!cacheManager,
      browserManager: !!browserManager,
      mapParser: !!mapParser
    },
    timestamp: new Date().toISOString()
  });
});

// Получить все карты
app.get('/api/maps', async (req, res) => {
  try {
    await initializeComponents();
    
    if (allMaps.length === 0) {
      allMaps = await loadMaps();
    }
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    
    let filteredMaps = allMaps;
    
    // Поиск по названию
    if (search) {
      filteredMaps = allMaps.filter(map => 
        map.title.toLowerCase().includes(search.toLowerCase()) ||
        map.description.toLowerCase().includes(search.toLowerCase()) ||
        (map.tags && map.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase())))
      );
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMaps = filteredMaps.slice(startIndex, endIndex);
    
    res.json({
      maps: paginatedMaps,
      total: filteredMaps.length,
      page,
      limit,
      totalPages: Math.ceil(filteredMaps.length / limit)
    });
    
  } catch (error) {
    logger.error('API Error:', error as Error);
    res.status(500).json({ error: 'Ошибка получения карт' });
  }
});

// Получить детальную информацию о карте
app.get('/api/maps/:id', async (req, res) => {
  try {
    await initializeComponents();
    
    const mapId = req.params.id;
    let map = allMaps.find(m => m.mid === mapId);
    
    if (!map) {
      res.status(404).json({ error: 'Карта не найдена' });
      return;
    }
    
    // Если у карты нет детальной информации, получаем её (если парсер доступен)
    if (!map.mapFiles || map.mapFiles.length === 0) {
      if (mapParser) {
        try {
          map = await mapParser.getDetailedMapInfo(map);
          // Обновляем в массиве
          const index = allMaps.findIndex(m => m.mid === mapId);
          if (index !== -1) {
            allMaps[index] = map;
          }
        } catch (error) {
          logger.warn(`⚠️ Не удалось получить детальную информацию для карты ${mapId}:`, error as Error);
        }
      } else {
        logger.warn(`⚠️ Парсер недоступен, детальная информация для карты ${mapId} недоступна`);
      }
    }
    
    res.json(map);
    
  } catch (error) {
    logger.error('API Error:', error as Error);
    res.status(500).json({ error: 'Ошибка получения детальной информации' });
  }
});

// Принудительное обновление карт
app.post('/api/refresh', async (req, res) => {
  try {
    await initializeComponents();
    
    logger.info('🔄 Принудительное обновление карт...');
    allMaps = await loadMaps();
    
    res.json({ 
      success: true, 
      count: allMaps.length,
      message: 'Карты обновлены' 
    });
    
  } catch (error) {
    logger.error('API Error:', error as Error);
    res.status(500).json({ error: 'Ошибка обновления карт' });
  }
});

// Статистика
app.get('/api/stats', async (req, res) => {
  try {
    await initializeComponents();
    
    if (!cacheManager) {
      res.status(500).json({ error: 'Кеш-менеджер не инициализирован' });
      return;
    }
    
    const stats = cacheManager.getStats();
    
    res.json({
      totalMaps: allMaps.length,
      ...stats
    });
    
  } catch (error) {
    logger.error('API Error:', error as Error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Обработка выключения сервера
process.on('SIGINT', async () => {
  logger.info('🛑 Завершение работы веб-сервера...');
  
  if (browserManager) {
    await browserManager.close();
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Завершение работы веб-сервера...');
  
  if (browserManager) {
    await browserManager.close();
  }
  
  process.exit(0);
});

// Запуск сервера
app.listen(port, () => {
  logger.success(`🌐 Веб-сервер запущен на http://localhost:${port}`);
  logger.info('📖 Для просмотра карт откройте браузер и перейдите по указанному адресу');
});

