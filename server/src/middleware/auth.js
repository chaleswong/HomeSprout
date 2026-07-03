import fs from 'fs/promises';

/**
 * 创建认证中间件
 * 读取配置文件中的 admin_token 和角色映射
 * @param {string} configPath - 配置文件路径
 * @returns {Function} Express 中间件
 */
export function createAuthMiddleware(configPath) {
  let config = null;

  return async (req, res, next) => {
    try {
      // 懒加载配置（首次请求时读取）
      if (!config) {
        const raw = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(raw);
      }

      const authHeader = req.headers.authorization;
      const adminToken = config.auth?.admin_token;
      const roles = config.auth?.roles || {};

      // 检查 Bearer token 是否为管理员令牌
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (token === adminToken) {
          req.userRole = 'admin';
          return next();
        }
      }

      // 基于 IP 地址的角色映射
      const clientIp = req.ip || req.connection?.remoteAddress || '';
      if (roles[clientIp]) {
        req.userRole = roles[clientIp];
        return next();
      }

      // 默认角色为 creator（家庭成员）
      req.userRole = 'creator';
      next();
    } catch (error) {
      console.error('[Auth] 认证中间件错误:', error.message);
      req.userRole = 'creator';
      next();
    }
  };
}

/**
 * 管理员权限检查中间件
 * 非管理员返回 403 Forbidden
 */
export function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: '需要管理员权限',
    });
  }
  next();
}
