import UserAgent from 'user-agents';

export class UserAgentsUtil {
  static get random() {
    // using chrome by default
    const userAgent = new UserAgent(/Chrome/);
    return userAgent.random().data.userAgent;
  }
}
