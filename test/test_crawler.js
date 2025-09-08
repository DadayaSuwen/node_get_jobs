const BossJobCrawler = require('../src/BossJobCrawler');
const fs = require('fs').promises;

// 创建测试配置
const testConfig = {
  "sayHi": "您好，我对这个职位很感兴趣，希望能进一步沟通，谢谢！",
  "debugger": false,
  "keywords": ["Node.js开发"],
  "cityCode": ["101020100"], // 上海
  "customCityCode": {},
  "industry": ["0"],
  "experience": ["0"],
  "jobType": "0",
  "salary": "0",
  "degree": ["0"],
  "scale": ["0"],
  "stage": ["0"],
  "enableAI": false,
  "filterDeadHR": false,
  "sendImgResume": false,
  "expectedSalary": [],
  "waitTime": "3-5",
  "deadStatus": ["离线", "刚刚活跃"]
};

async function test() {
  let crawler = null;
  
  try {
    console.log('开始测试BossJobCrawler...');
    
    // 初始化爬虫
    crawler = new BossJobCrawler(testConfig);
    await crawler.init(true); // 使用无头模式测试
    
    console.log('BossJobCrawler初始化成功');
    
    // 测试获取搜索URL
    const searchUrl = crawler.getSearchUrl(testConfig.cityCode[0]);
    console.log('搜索URL:', searchUrl);
    
    // 测试随机等待时间
    const waitTime = crawler.getRandomWaitTime();
    console.log('随机等待时间:', waitTime, '秒');
    
    // 测试薪资解码
    const testSalary = 'K-K';
    const decodedSalary = crawler.decodeSalary(testSalary);
    console.log('薪资解码测试:', testSalary, '->', decodedSalary);
    
    console.log('测试完成');
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    // 关闭浏览器
    if (crawler) {
      await crawler.close();
    }
  }
}

test();