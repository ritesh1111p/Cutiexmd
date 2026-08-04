class UrlUtil {
  static extract(text) {
    if (typeof text !== 'string') return [];
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    return text.match(urlRegex) || [];
  }
}

export default UrlUtil;
