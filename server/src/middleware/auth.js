import fs from 'fs/promises';

/**
 * 创建认证中间件
 * 优先从环境变量读取 admin_token，其次从配置文件读取
 * @param {string} configPath - 配置文件路径
 * @returns {Function} Express 中间件
 */
export function createAuthMiddleware(configPath) {
  let config = null;

  return async (req, res, next) => {
    try {
      if (!config) {
        const raw = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(raw);
      }

      const authHeader = req.headers.authorization;
      const adminToken = process.env.ADMIN_TOKEN || config.auth?.admin_token;
      const roles = config.auth?.roles || {};

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (token === adminToken) {
          req.userRole = 'admin';
          return next();
        }
      }

      const clientIp = req.ip || req.connection?.remoteAddress || '';
      if (roles[clientIp]) {
        req.userRole = roles[clientIp];
        return next();
      }

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
