const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const AiService = require('./AiService');

class BossJobCrawler {
  constructor(config) {
    this.config = config;
    this.homeUrl = 'https://www.zhipin.com';
    this.baseUrl = 'https://www.zhipin.com/web/geek/job?';
    this.blackCompanies = new Set();
    this.blackRecruiters = new Set();
    this.blackJobs = new Set();
    this.resultList = [];
    this.dataPath = path.join(__dirname, '../data.json');
    this.cookiePath = path.join(__dirname, '../cookie.json');
    
    // 初始化AI服务
    if (config.enableAI) {
      this.aiService = new AiService(config);
    }
  }

  async init(headless = true) {
    // 确保数据文件存在
    await this.ensureDataFiles();
    
    // 读取黑名单数据
    await this.loadData();
    
    // 初始化浏览器
    this.browser = await chromium.launch({ 
      headless,
      slowMo: 50
    });
    
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
    });
    
    this.page = await this.context.newPage();
    await this.page.setDefaultTimeout(30000);
  }

  async ensureDataFiles() {
    try {
      // 检查数据文件
      try {
        await fs.access(this.dataPath);
      } catch {
        // 创建初始数据文件
        const initialData = {
          blackCompanies: [],
          blackRecruiters: [],
          blackJobs: []
        };
        await fs.writeFile(this.dataPath, JSON.stringify(initialData, null, 2));
      }
      
      // 检查cookie文件
      try {
        await fs.access(this.cookiePath);
      } catch {
        // 创建空的cookie文件
        await fs.writeFile(this.cookiePath, '[]');
      }
    } catch (error) {
      console.error('创建文件时发生异常:', error.message);
    }
  }

  async loadData() {
    try {
      const data = JSON.parse(await fs.readFile(this.dataPath, 'utf8'));
      this.blackCompanies = new Set(data.blackCompanies || []);
      this.blackRecruiters = new Set(data.blackRecruiters || []);
      this.blackJobs = new Set(data.blackJobs || []);
    } catch (error) {
      console.error('读取数据文件失败:', error.message);
    }
  }

  async saveData() {
    try {
      // 更新黑名单数据
      await this.updateListData();
      
      const data = {
        blackCompanies: Array.from(this.blackCompanies),
        blackRecruiters: Array.from(this.blackRecruiters),
        blackJobs: Array.from(this.blackJobs)
      };
      
      await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('保存数据文件失败:', error.message);
    }
  }

  async login() {
    console.log('正在检查登录状态...');
    
    // 检查cookie文件是否存在且有内容
    const hasValidCookies = await this.hasValidCookieContent();
    
    if (hasValidCookies) {
      console.log('检测到有效的cookie，正在加载...');
      await this.loadCookies();
      await this.page.goto(this.homeUrl);
      await this.page.waitForTimeout(1000);
      await this.waitForSliderVerify();
      await this.initStealth();
      
      // 检查是否需要登录
      if (await this.isLoginRequired()) {
        console.log('cookie已过期，需要重新登录...');
        await this.scanLogin();
      } else {
        console.log('已登录，直接开始投递...');
      }
    } else {
      console.log('未检测到有效cookie，需要扫码登录...');
      await this.scanLogin();
    }
  }
  
  async hasValidCookieContent() {
    try {
      await fs.access(this.cookiePath);
      const cookies = JSON.parse(await fs.readFile(this.cookiePath, 'utf8'));
      // 检查cookie文件是否有内容
      return Array.isArray(cookies) && cookies.length > 0;
    } catch {
      return false;
    }
  }

  async waitForSliderVerify() {
    const SLIDER_URL = 'https://www.zhipin.com/web/user/safe/verify-slider';
    const startTime = Date.now();
    
    // 最多等待5分钟
    while (Date.now() - startTime < 5 * 60 * 1000) {
      const url = this.page.url();
      if (url && url.startsWith(SLIDER_URL)) {
        console.log('\n【滑块验证】请手动完成Boss直聘滑块验证，通过后在控制台回车继续…');
        // 等待用户输入
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        await new Promise((resolve) => {
          process.stdin.once('data', () => {
            process.stdin.pause();
            resolve();
          });
        });
        await this.page.waitForTimeout(1000);
        continue;
      }
      break;
    }
  }

  async isCookieValid() {
    try {
      await fs.access(this.cookiePath);
      return true;
    } catch {
      return false;
    }
  }

  async loadCookies() {
    try {
      const cookies = JSON.parse(await fs.readFile(this.cookiePath, 'utf8'));
      await this.context.addCookies(cookies);
      console.log('已加载cookie');
    } catch (error) {
      console.error('加载cookie失败:', error.message);
    }
  }

  async saveCookies() {
    try {
      const cookies = await this.context.cookies();
      await fs.writeFile(this.cookiePath, JSON.stringify(cookies, null, 2));
      console.log('已保存cookie');
    } catch (error) {
      console.error('保存cookie失败:', error.message);
    }
  }

  async isLoginRequired() {
    try {
      const loginButton = await this.page.$('//li[@class=\'nav-figure\']');
      if (loginButton) {
        const text = await loginButton.innerText();
        return text.includes('登录');
      }
      return false;
    } catch (error) {
      try {
        await this.page.waitForSelector('//h1', { timeout: 5000 });
        const errorLoginLocator = await this.page.$('//a[@ka=\'403_login\']');
        if (errorLoginLocator) {
          await errorLoginLocator.click();
        }
        return true;
      } catch (ex) {
        console.log('没有出现403访问异常');
        console.log('cookie有效，已登录...');
        return false;
      }
    }
  }

  async ensureLogin() {
    // 检查是否需要登录
    if (await this.isLoginRequired()) {
      console.log('检测到未登录，重新登录...');
      await this.login();
    } else {
      console.log('已登录，继续执行...');
    }
  }

  async scanLogin() {
    // 访问登录页面
    await this.page.goto(this.homeUrl + '/web/user/?ka=header-login');
    await this.page.waitForTimeout(1000);
    
    console.log('等待登录...');
    
    try {
      // 定位二维码登录的切换按钮
      const scanButton = await this.page.$('//div[@class=\'btn-sign-switch ewm-switch\']');
      if (scanButton) {
        await scanButton.click();
      }
      
      // 等待登录完成
      const startTime = Date.now();
      const TIMEOUT = 10 * 60 * 1000; // 10分钟
      
      while (Date.now() - startTime < TIMEOUT) {
        try {
          // 检查是否出现职位列表容器
          const jobList = await this.page.$('div.job-list-container');
          if (jobList && await jobList.isVisible()) {
            console.log('用户已登录！');
            // 登录成功，保存Cookie
            await this.saveCookies();
            break;
          }
        } catch (error) {
          console.error('检测元素时异常:', error.message);
        }
        // 每2秒检查一次
        await this.page.waitForTimeout(2000);
      }
      
      if (Date.now() - startTime >= TIMEOUT) {
        console.error('超过10分钟未完成登录，程序退出...');
        process.exit(1);
      }
    } catch (error) {
      console.error('未找到二维码登录按钮，登录失败:', error.message);
    }
  }

  async initStealth() {
    // 设置额外的HTTP头
    await this.context.setExtraHTTPHeaders({
      'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'accept-language': 'zh-CN,zh;q=0.9',
      'referer': 'https://www.zhipin.com/',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin'
    });
    
    // 注入反检测脚本
    await this.page.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_JSON;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Object;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Proxy;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Window;
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN', 'zh']});
      Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3]});
      Object.defineProperty(navigator, 'injected', {get: () => 123});
    `);
    
    console.log('已启用Stealth模式');
  }

  getSearchUrl(cityCode) {
    let url = this.baseUrl + 'city=' + cityCode;
    
    if (this.config.jobType && this.config.jobType !== '0') {
      url += '&jobType=' + this.config.jobType;
    }
    
    if (this.config.salary && this.config.salary !== '0') {
      url += '&salary=' + this.config.salary;
    }
    
    if (this.config.experience && this.config.experience.length > 0 && this.config.experience[0] !== '0') {
      url += '&experience=' + this.config.experience.join(',');
    }
    
    if (this.config.degree && this.config.degree.length > 0 && this.config.degree[0] !== '0') {
      url += '&degree=' + this.config.degree.join(',');
    }
    
    if (this.config.scale && this.config.scale.length > 0 && this.config.scale[0] !== '0') {
      url += '&scale=' + this.config.scale.join(',');
    }
    
    if (this.config.industry && this.config.industry.length > 0 && this.config.industry[0] !== '0') {
      url += '&industry=' + this.config.industry.join(',');
    }
    
    if (this.config.stage && this.config.stage.length > 0 && this.config.stage[0] !== '0') {
      url += '&stage=' + this.config.stage.join(',');
    }
    
    return url;
  }

  async postJobByCity(cityCode) {
    const searchUrl = this.getSearchUrl(cityCode);
    const keywords = this.config.keywords || [];
    
    for (const keyword of keywords) {
      let postCount = 0;
      const encodedKeyword = encodeURIComponent(keyword);
      const url = searchUrl + '&query=' + encodedKeyword;
      console.log('投递地址:', url);
      
      // 确保已登录
      await this.ensureLogin();
      
      await this.page.goto(url);
      
      // 1. 滚动到底部，加载所有岗位卡片
      let lastCount = -1;
      while (true) {
        // 滑动到底部
        await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight);');
        await this.page.waitForTimeout(1000); // 等待加载
        
        // 获取所有卡片数
        const cards = await this.page.$$('//ul[contains(@class, \'rec-job-list\')]//li[contains(@class, \'job-card-box\')]');
        const currentCount = cards.length;
        
        // 判断是否继续滑动
        if (currentCount === lastCount) {
          break; // 没有新内容，跳出循环
        }
        lastCount = currentCount;
      }
      console.log(`【${keyword}】岗位已全部加载，总数:${lastCount}`);
      
      // 2. 回到页面顶部
      await this.page.evaluate('window.scrollTo(0, 0);');
      await this.page.waitForTimeout(1000);
      
      // 3. 逐个遍历所有岗位
      const cards = await this.page.$$('//ul[contains(@class, \'rec-job-list\')]//li[contains(@class, \'job-card-box\')]');
      const count = cards.length;
      
      for (let i = 0; i < count; i++) {
        try {
          const cards = await this.page.$$('//ul[contains(@class, \'rec-job-list\')]//li[contains(@class, \'job-card-box\')]');
          if (i >= cards.length) continue;
          
          // 在新页面中打开岗位详情
          const detailPage = await this.context.newPage();
          await detailPage.goto(this.page.url());
          await detailPage.waitForTimeout(1000);
          
          // 点击第i个岗位卡片
          const detailCards = await detailPage.$$('//ul[contains(@class, \'rec-job-list\')]//li[contains(@class, \'job-card-box\')]');
          if (i >= detailCards.length) {
            await detailPage.close();
            continue;
          }
          
          await detailCards[i].click();
          await detailPage.waitForTimeout(1000);
          
          // 等待详情内容加载
          try {
            await detailPage.waitForSelector('div[class*="job-detail-box"]', { timeout: 4000 });
          } catch (error) {
            console.warn('岗位详情加载超时，跳过...');
            await detailPage.close();
            continue;
          }
          
          // 岗位名称
          const jobName = await this.safeTextFromPage(detailPage, 'span[class*="job-name"]');
          if (Array.from(this.blackJobs).some(job => jobName.includes(job))) {
            await detailPage.close();
            continue;
          }
          
          // 薪资(原始)
          const jobSalaryRaw = await this.safeTextFromPage(detailPage, 'span.job-salary');
          const jobSalary = this.decodeSalary(jobSalaryRaw);
          
          // 城市/经验/学历
          const tags = await this.safeAllTextFromPage(detailPage, 'ul[class*="tag-list"] > li');
          
          // 岗位描述
          const jobDesc = await this.safeTextFromPage(detailPage, 'p.desc');
          
          // Boss姓名、活跃
          const bossNameRaw = await this.safeTextFromPage(detailPage, 'h2[class*="name"]');
          const [bossName, bossActive] = this.splitBossName(bossNameRaw);
          
          // 检查HR活跃度
          if (this.config.filterDeadHR && this.config.deadStatus.some(status => bossActive.includes(status))) {
            await detailPage.close();
            continue;
          }
          
          // Boss公司/职位
          const bossTitleRaw = await this.safeTextFromPage(detailPage, 'div[class*="boss-info-attr"]');
          const [bossCompany, bossJobTitle] = this.splitBossTitle(bossTitleRaw);
          
          if (Array.from(this.blackCompanies).some(company => bossCompany.includes(company))) {
            await detailPage.close();
            continue;
          }
          if (Array.from(this.blackRecruiters).some(recruiter => bossJobTitle.includes(recruiter))) {
            await detailPage.close();
            continue;
          }
          
          // 创建Job对象
          const job = {
            jobName,
            salary: jobSalary,
            jobArea: tags.join(', '),
            companyName: bossCompany,
            recruiter: bossName,
            jobInfo: jobDesc
          };
          
          // 投递简历
          await this.resumeSubmission(keyword, job, detailPage);
          postCount++;
          
          // 随机等待
          const waitTime = this.getRandomWaitTime();
          console.log(`等待${waitTime}秒后继续...`);
          await this.page.waitForTimeout(waitTime * 1000);
        } catch (error) {
          console.error('处理岗位时出错:', error.message);
          // 发生错误时确保详情页面已关闭
          try {
            if (detailPage && !detailPage.isClosed()) {
              await detailPage.close();
            }
          } catch (e) {
            console.warn('关闭详情页面失败');
          }
        }
      }
      console.log(`【${keyword}】岗位已投递完毕！已投递岗位数量:${postCount}`);
    }
  }

  getRandomWaitTime() {
    const waitTime = this.config.waitTime || '3-10';
    const [min, max] = waitTime.split('-').map(Number);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  decodeSalary(text) {
    const fontMap = {
      '': '0',
      '': '1',
      '': '2',
      '': '3',
      '': '4',
      '': '5',
      '': '6',
      '': '7',
      '': '8',
      '': '9'
    };
    
    let result = '';
    for (const c of text) {
      result += fontMap[c] || c;
    }
    return result;
  }

  async safeText(selector) {
    try {
      const element = await this.page.$(selector);
      if (element) {
        const text = await element.innerText();
        return text ? text.trim() : '';
      }
    } catch (error) {
      // ignore
    }
    return '';
  }

  async safeAllText(selector) {
    try {
      const elements = await this.page.$$(selector);
      const texts = [];
      for (const element of elements) {
        const text = await element.innerText();
        if (text) texts.push(text.trim());
      }
      return texts;
    } catch (error) {
      return [];
    }
  }

  async safeAllTextFromPage(page, selector) {
    try {
      const elements = await page.$$(selector);
      const texts = [];
      for (const element of elements) {
        const text = await element.innerText();
        if (text) texts.push(text.trim());
      }
      return texts;
    } catch (error) {
      return [];
    }
  }

  splitBossName(raw) {
    const bossParts = raw.trim().split(/\s+/);
    const bossName = bossParts[0];
    const bossActive = bossParts.length > 1 ? bossParts.slice(1).join(' ') : '';
    return [bossName, bossActive];
  }

  async safeTextFromPage(page, selector) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.innerText();
        return text ? text.trim() : '';
      }
    } catch (error) {
      // ignore
    }
    return '';
  }

  splitBossTitle(raw) {
    const parts = raw.trim().split(' · ');
    const company = parts[0];
    const job = parts.length > 1 ? parts[1] : '';
    return [company, job];
  }

  async resumeSubmission(keyword, job, detailPage = null) {
    const pageToUse = detailPage || this.page;
    await pageToUse.waitForTimeout(1000);
    
    // 1. 查找"查看更多信息"按钮
    const moreInfoBtn = await pageToUse.$('a.more-job-btn');
    if (!moreInfoBtn) {
      console.warn('未找到"查看更多信息"按钮，跳过...');
      return;
    }
    
    // 获取详情页链接
    const href = await moreInfoBtn.getAttribute('href');
    if (!href || !href.startsWith('/job_detail/')) {
      console.warn('未获取到岗位详情链接，跳过...');
      return;
    }
    
    const detailUrl = 'https://www.zhipin.com' + href;
    
    // 2. 新开详情页
    const chatPage = await this.context.newPage();
    await chatPage.goto(detailUrl);
    await chatPage.waitForTimeout(1000); // 页面加载
    
    try {
      // 3. 查找"立即沟通"按钮
      let chatBtn = await chatPage.$('a.btn-startchat, a.op-btn-chat');
      let foundChatBtn = false;
      
      for (let i = 0; i < 5; i++) {
        if (chatBtn) {
          const text = await chatBtn.innerText();
          if (text.includes('立即沟通')) {
            foundChatBtn = true;
            break;
          }
        }
        await chatPage.waitForTimeout(1000);
        chatBtn = await chatPage.$('a.btn-startchat, a.op-btn-chat');
      }
      
      if (!foundChatBtn) {
        console.warn('未找到立即沟通按钮，跳过岗位:', job.jobName);
        await chatPage.close();
        return;
      }
      
      await chatBtn.click();
      await chatPage.waitForTimeout(1000);
      
      // 4. 等待聊天输入框
      let inputLocator = await chatPage.$('div#chat-input.chat-input[contenteditable=\'true\'], textarea.input-area');
      let inputReady = false;
      
      for (let i = 0; i < 10; i++) {
        if (inputLocator && await inputLocator.isVisible()) {
          inputReady = true;
          break;
        }
        await chatPage.waitForTimeout(1000);
        inputLocator = await chatPage.$('div#chat-input.chat-input[contenteditable=\'true\'], textarea.input-area');
      }
      
      if (!inputReady) {
        console.warn('聊天输入框未出现，跳过:', job.jobName);
        await chatPage.close();
        return;
      }
      
      // 5. AI智能生成打招呼语
      let message = this.config.sayHi.replace(/[\r\n]/g, '');
      if (this.config.enableAI && this.aiService) {
        const jd = job.jobInfo;
        if (jd && jd.trim() !== '') {
          const aiResult = await this.aiService.checkJob(keyword, job.jobName, jd, this.config.sayHi);
          if (aiResult.result && aiResult.message) {
            message = aiResult.message;
          }
        }
      }
      
      // 6. 输入打招呼语
      await inputLocator.click();
      
      const tagName = await chatPage.evaluate(el => el.tagName.toLowerCase(), inputLocator);
      if (tagName === 'textarea') {
        await inputLocator.fill(message);
      } else {
        await chatPage.evaluate((el, msg) => el.innerText = msg, inputLocator, message);
      }
      
      // 7. 发送图片简历（可选）
      let imgResume = false;
      if (this.config.sendImgResume) {
        try {
          // 注意：在Node.js中发送图片简历需要额外处理
          console.log('图片简历发送功能在Node.js版本中需要额外配置');
        } catch (error) {
          console.error('发送图片简历失败:', error.message);
        }
      }
      
      // 8. 点击发送按钮
      const sendBtn = await chatPage.$('div.send-message, button[type=\'send\'].btn-send, button.btn-send');
      let sendSuccess = false;
      
      if (sendBtn) {
        await sendBtn.click();
        await chatPage.waitForTimeout(1000);
        sendSuccess = true;
      } else {
        console.warn('未找到发送按钮，自动跳过！岗位：', job.jobName);
      }
      
      console.log('投递完成 | 岗位：', job.jobName, '| 招呼语：', message, '| 图片简历：', imgResume ? '已发送' : '未发送');
      
      // 9. 关闭详情页
      await chatPage.close();
      await pageToUse.waitForTimeout(1000);
      
      // 10. 成功投递加入结果
      if (sendSuccess) {
        this.resultList.push(job);
      }
    } catch (error) {
      console.error('投递过程中出错:', error.message);
      await chatPage.close();
    }
  }

  async updateListData() {
    try {
      await this.page.goto('https://www.zhipin.com/web/geek/chat');
      await this.page.waitForTimeout(3000);
      
      let shouldBreak = false;
      while (!shouldBreak) {
        try {
          const bottomLocator = await this.page.$('//div[@class=\'finished\']');
          if (bottomLocator) {
            const text = await bottomLocator.innerText();
            if (text === '没有更多了') {
              shouldBreak = true;
            }
          }
        } catch (ignore) {}
        
        const items = await this.page.$$('//li[@role=\'listitem\']');
        const itemCount = items.length;
        
        for (let i = 0; i < itemCount; i++) {
          try {
            const companyElements = await this.page.$$('//div[@class=\'title-box\']/span[@class=\'name-box\']//span[2]');
            const messageElements = await this.page.$$('//div[@class=\'gray last-msg\']/span[@class=\'last-msg-text\']');
            
            if (i >= companyElements.length || i >= messageElements.length) {
              break;
            }
            
            const companyName = await companyElements[i].innerText();
            const message = await messageElements[i].innerText();
            
            if (companyName && message) {
              const match = message.includes('不') || message.includes('感谢') || message.includes('但') ||
                           message.includes('遗憾') || message.includes('需要本') || message.includes('对不');
              const nomatch = message.includes('不是') || message.includes('不生');
              
              if (match && !nomatch) {
                console.log('黑名单公司：【' + companyName + '】，信息：【' + message + '】');
                if (Array.from(this.blackCompanies).some(c => companyName.includes(c))) {
                  continue;
                }
                const cleanCompanyName = companyName.replace(/\.{3}/g, '');
                if (cleanCompanyName.match(/.*([\u4e00-\u9fa5]{2,}|[a-zA-Z]{4,}).*/u)) {
                  this.blackCompanies.add(cleanCompanyName);
                }
              }
            }
          } catch (error) {
            console.error('寻找黑名单公司异常...', error.message);
          }
        }
        
        try {
          const scrollElement = await this.page.$('//div[contains(text(), \'滚动加载更多\')]');
          if (scrollElement) {
            await scrollElement.scrollIntoViewIfNeeded();
          } else {
            await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight);');
          }
        } catch (error) {
          console.error('滚动元素出错', error.message);
          break;
        }
      }
      console.log('黑名单公司数量：', this.blackCompanies.size);
    } catch (error) {
      console.error('更新黑名单数据失败:', error.message);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = BossJobCrawler;