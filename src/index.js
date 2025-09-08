const BossJobCrawler = require('./BossJobCrawler');
const fs = require('fs').promises;

async function main() {
  let crawler = null;
  
  try {
    // 读取配置文件
    const configData = await fs.readFile('./config.json', 'utf8');
    const config = JSON.parse(configData);
    
    // 初始化爬虫
    crawler = new BossJobCrawler(config);
    await crawler.init(false); // 使用非无头模式以便调试
    
    // 登录
    await crawler.login();
    
    // 开始投递
    const cityCodes = config.cityCode || [];
    for (const cityCode of cityCodes) {
      console.log(`开始在城市代码 ${cityCode} 中搜索岗位...`);
      await crawler.postJobByCity(cityCode);
    }
    
    console.log('投递完成，共投递', crawler.resultList.length, '个岗位');
    console.log('投递结果:', crawler.resultList);
    
    // 保存数据
    await crawler.saveData();
  } catch (error) {
    console.error('程序执行出错:', error);
  } finally {
    // 关闭浏览器
    if (crawler) {
      await crawler.close();
    }
  }
}

main();