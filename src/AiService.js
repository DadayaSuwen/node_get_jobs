const axios = require('axios');

class AiService {
  constructor(config) {
    this.baseUrl = config.api.baseUrl;
    this.apiKey = config.api.apiKey;
    this.model = config.api.model;
    this.aiConfig = config.ai;
  }

  async sendRequest(content) {
    try {
      const requestData = {
        model: this.model,
        temperature: 0.5,
        messages: [
          {
            role: 'user',
            content: content
          }
        ]
      };

      const response = await axios.post(this.baseUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 60000 // 60秒超时
      });

      if (response.status === 200) {
        const responseData = response.data;
        const messageObject = responseData.choices[0].message;
        return messageObject.content;
      } else {
        console.error('AI请求失败！状态码:', response.status);
        return '';
      }
    } catch (error) {
      console.error('AI请求异常:', error.message);
      return '';
    }
  }

  async checkJob(keyword, jobName, jd, sayHi) {
    if (!this.aiConfig) {
      return { result: false, message: sayHi };
    }

    const requestMessage = this.aiConfig.prompt.replace('%s', this.aiConfig.introduce)
      .replace('%s', keyword)
      .replace('%s', jobName)
      .replace('%s', jd)
      .replace('%s', sayHi);

    const result = await this.sendRequest(requestMessage);
    return result.includes('false') ? { result: false } : { result: true, message: result };
  }

  static cleanBossDesc(raw) {
    return raw.replace(/kanzhun|BOSS直聘|来自BOSS直聘/g, '')
      .replace(/[\u200b-\u200d\uFEFF]/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = AiService;