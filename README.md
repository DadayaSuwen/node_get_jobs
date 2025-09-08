# Node.js版本Boss直聘自动投递工具

[![GitHub stars](https://img.shields.io/github/stars/DadayaSuwen/node_get_jobs?style=flat&label=Stars)](https://github.com/DadayaSuwen/node_get_jobs)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/DadayaSuwen/node_get_jobs/blob/main/LICENSE)

这是一个基于Node.js和Playwright的Boss直聘自动投递工具，支持AI智能筛选和自动打招呼功能。

**项目地址**: https://github.com/DadayaSuwen/node_get_jobs

## 功能特点

1. **自动登录**: 支持扫码登录，自动保存和加载Cookie
2. **智能投递**: 根据配置的关键词、城市、薪资等条件自动搜索和投递岗位
3. **AI智能筛选**: 集成AI功能，智能分析岗位匹配度并生成个性化打招呼语
4. **黑名单管理**: 自动识别并记录不合适的公司和HR
5. **反检测机制**: 使用Stealth模式避免被网站识别为自动化工具
6. **随机等待**: 模拟人工操作，避免被封禁

## 安装依赖

```bash
npm install
npx playwright install-deps
npx playwright install
```

## 配置文件详解 (config.json)

### 基本配置

```json
{
  "sayHi": "您好，我是一名有2年前端开发经验的工程师，熟练掌握React和TypeScript，希望应聘这个岗位，期待可以与您进一步沟通，谢谢！",
  "debugger": false,
  "keywords": ["前端工程师", "React", "TypeScript", "JavaScript"],
  "cityCode": ["101280100"],
  "industry": ["100001"],
  "experience": ["102"],
  "jobType": "1901",
  "salary": "405",
  "degree": ["0"],
  "scale": ["0"],
  "stage": ["0"],
  "enableAI": true,
  "filterDeadHR": true,
  "expectedSalary": [12, 20],
  "waitTime": "3-10",
  "deadStatus": ["2周内活跃", "本月活跃", "2月内活跃", "半年前活跃"]
}
```

### 配置字段说明

- **sayHi**: 默认打招呼语，当AI功能关闭时使用
- **debugger**: 调试模式，开启后显示更多日志信息
- **keywords**: 搜索关键词数组，支持多个关键词
- **cityCode**: 城市编码数组，参考 `boss城市编码.xlsx`
- **industry**: 行业编码数组，参考 `boss行业编码.xlsx`
- **experience**: 工作经验编码，如 "102" 表示 "1-3年"
- **jobType**: 工作类型编码，"1901" 表示 "全职"
- **salary**: 薪资范围编码，"405" 表示 "10-20K"
- **degree**: 学历要求编码数组
- **scale**: 公司规模编码数组
- **stage**: 融资阶段编码数组
- **enableAI**: 是否启用AI智能打招呼功能
- **filterDeadHR**: 是否过滤不活跃的HR
- **expectedSalary**: 期望薪资范围 [最小值, 最大值]，单位：K
- **waitTime**: 操作等待时间范围 "最小值-最大值"，单位：秒
- **deadStatus**: HR不活跃状态列表，用于过滤不活跃HR

## AI智能打招呼配置

启用AI功能后，系统会根据岗位要求智能生成个性化的打招呼语：

### API配置

```json
{
  "api": {
    "baseUrl": "https://api.deepseek.com/chat/completions",
    "apiKey": "your-deepseek-api-key",
    "model": "deepseek-chat"
  },
  "ai": {
    "introduce": "我是一名有2年前端开发经验的工程师，熟练掌握React、TypeScript、JavaScript等技术栈，熟悉前端工程化和组件化开发，有丰富的Vue和React项目经验，熟悉Webpack、Vite等构建工具，了解前端性能优化和用户体验优化，熟悉Git版本控制和团队协作开发流程，具备良好的代码规范和文档编写能力。",
    "prompt": "我目前在找工作,%s,我期望的的岗位方向是【%s】,目前我需要投递的岗位名称是【%s】,这个岗位的要求是【%s】,如果这个岗位和我的期望与经历基本符合，注意是基本符合，那么请帮我写一个给HR打招呼的文本发给我，如果这个岗位和我的期望经历完全不相干，直接返回false给我，注意只要返回我需要的内容即可，不要有其他的语气助词，重点要突出我和岗位的匹配度以及我的优势，我自己写的招呼语是：【%s】,你可以参照我自己写的根据岗位情况进行适当调整"
  }
}
```

### AI功能说明

- **baseUrl**: DeepSeek API地址
- **apiKey**: 您的DeepSeek API密钥
- **model**: 使用的模型名称
- **ai.introduce**: 您的个人介绍，用于AI生成打招呼语
- **ai.prompt**: AI提示词模板，系统会自动填充岗位信息

### 测试配置

项目还提供了 `config_test.json` 文件用于测试环境：

```json
{
  "api": {
    "baseUrl": "https://api.test.deepseek.com/chat/completions",
    "apiKey": "test-api-key-1234567890abcdef",
    "model": "deepseek-chat-test"
  }
}
```

## 数据文件配置 (data.json)

`data.json` 用于存储黑名单和过滤规则：

```json
{
  "blackCompanies": ["公司A", "公司B"],
  "blackRecruiters": ["猎头"],
  "blackJobs": ["外包", "外派"]
}
```

- **blackCompanies**: 公司黑名单，不会投递这些公司
- **blackRecruiters**: HR类型黑名单，如过滤猎头
- **blackJobs**: 岗位类型黑名单，如过滤外包岗位

## 运行程序

### 安装依赖
```bash
npm install
```

### 运行主程序
```bash
npm start
```

### 开发模式
```bash
npm run dev
```

### 测试模式（使用测试配置）
```bash
npm test
```

## 注意事项

1. **首次运行**: 需要扫码登录Boss直聘，成功后会自动保存cookie.json
2. **验证码处理**: 可能会遇到滑块验证，需要手动完成
3. **投递频率**: 合理设置等待时间，避免账号被封禁
4. **AI功能**: 需要配置有效的DeepSeek API密钥
5. **配置文件**: 
   - `config.json` - 主配置文件（已加入.gitignore）
   - `config_test.json` - 测试环境配置
   - `cookie.json` - 登录凭证（自动生成，已加入.gitignore）
   - `data.json` - 黑名单数据

## 文件说明

- `config.json` - 主要配置文件，包含所有投递参数和AI设置
- `config_test.json` - 测试环境配置，使用测试API端点
- `boss城市编码.xlsx` - Boss直聘城市编码参考
- `boss行业编码.xlsx` - Boss直聘行业编码参考
- `cookie.json` - 自动保存的登录凭证
- `data.json` - 黑名单和过滤规则配置

## 声明

本工具仅供学习和研究使用，请遵守相关法律法规和Boss直聘服务条款，不要用于任何商业用途。使用者需自行承担相关风险。