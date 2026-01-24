/**
 * GitHub OAuth Authentication Routes
 */
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const https = require('https');
const router = express.Router();

// 创建忽略 SSL 证书验证的 agent
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Configuration - 请替换为您的 GitHub OAuth App 信息
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'YOUR_GITHUB_CLIENT_ID';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'YOUR_GITHUB_CLIENT_SECRET';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// 从 HOST_IP 自动生成 URL
const HOST_IP = process.env.HOST_IP || 'localhost';
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://${HOST_IP}:5173`;
const BACKEND_URL = process.env.BACKEND_URL || `http://${HOST_IP}:${PORT}`;

// 简单的内存存储 (生产环境应使用数据库)
const users = new Map();
const sessions = new Map();

/**
 * GET /api/auth/github
 * 重定向到 GitHub OAuth 授权页面
 */
router.get('/github', (req, res) => {
    // 使用环境变量配置的后端地址
    const redirectUri = `${BACKEND_URL}/api/auth/github/callback`;
    const scope = 'user:email read:user';
    
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    
    res.redirect(githubAuthUrl);
});

/**
 * GET /api/auth/github/callback
 * GitHub OAuth 回调处理
 */
router.get('/github/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect(`${FRONTEND_URL}/jupyter?error=no_code`);
    }
    
    try {
        // 1. 用 code 换取 access_token
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code: code
            },
            {
                headers: { Accept: 'application/json' },
                httpsAgent: httpsAgent
            }
        );
        
        const accessToken = tokenResponse.data.access_token;
        
        if (!accessToken) {
            console.error('GitHub OAuth failed:', tokenResponse.data);
            return res.redirect(`${FRONTEND_URL}/jupyter?error=token_failed`);
        }
        
        // 2. 获取用户信息
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${accessToken}` },
            httpsAgent: httpsAgent
        });
        
        const githubUser = userResponse.data;
        
        // 3. 获取用户邮箱
        let email = githubUser.email;
        if (!email) {
            try {
                const emailResponse = await axios.get('https://api.github.com/user/emails', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    httpsAgent: httpsAgent
                });
                const primaryEmail = emailResponse.data.find(e => e.primary);
                email = primaryEmail ? primaryEmail.email : null;
            } catch (e) {
                console.log('Could not fetch email');
            }
        }
        
        // 4. 创建或更新用户
        const user = {
            id: githubUser.id.toString(),
            username: githubUser.login,
            displayName: githubUser.name || githubUser.login,
            email: email,
            avatarUrl: githubUser.avatar_url,
            githubAccessToken: accessToken,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        
        users.set(user.id, user);
        
        // 5. 生成 JWT
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                displayName: user.displayName
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // 6. 重定向回前端，带上 token
        res.redirect(`${FRONTEND_URL}/jupyter/callback?token=${token}`);
        
    } catch (error) {
        console.error('GitHub OAuth error:', error.message);
        res.redirect(`${FRONTEND_URL}/jupyter?error=oauth_failed`);
    }
});

/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 */
router.get('/me', authenticateToken, (req, res) => {
    const user = users.get(req.user.userId);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // 不返回敏感信息
    res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        lastLogin: user.lastLogin
    });
});

/**
 * POST /api/auth/logout
 * 登出
 */
router.post('/logout', authenticateToken, (req, res) => {
    // 在实际应用中，可以将 token 加入黑名单
    res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * JWT 验证中间件
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
}

// 导出中间件供其他路由使用
router.authenticateToken = authenticateToken;

module.exports = router;
