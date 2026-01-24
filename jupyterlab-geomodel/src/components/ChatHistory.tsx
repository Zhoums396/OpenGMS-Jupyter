/**
 * 对话历史侧边栏组件
 * 显示历史对话列表，支持搜索、加载、删除
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { agentApi, ConversationSummary } from '../services/agentApi';

interface ChatHistoryProps {
    userId: string;
    currentConversationId: string | null;
    onSelectConversation: (conversationId: string) => void;
    onNewConversation: () => void;
    isVisible: boolean;
    onClose: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
    userId,
    currentConversationId,
    onSelectConversation,
    onNewConversation,
    isVisible,
    onClose
}) => {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);

    // 加载对话列表
    const loadConversations = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await agentApi.listConversations(userId, 50, 0);
            setConversations(result.conversations);
        } catch (e: any) {
            console.error('Failed to load conversations:', e);
            setError('加载历史对话失败');
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    // 搜索对话
    const searchConversations = useCallback(async (query: string) => {
        if (!query.trim()) {
            loadConversations();
            return;
        }
        
        setIsLoading(true);
        setError(null);
        try {
            const result = await agentApi.searchConversations(query, userId, 20);
            setConversations(result.results);
        } catch (e: any) {
            console.error('Failed to search conversations:', e);
            setError('搜索失败');
        } finally {
            setIsLoading(false);
        }
    }, [userId, loadConversations]);

    // 删除对话
    const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation();
        
        if (!confirm('确定要删除这个对话吗？')) {
            return;
        }
        
        try {
            await agentApi.deleteConversation(conversationId, userId);
            setConversations(prev => prev.filter(c => c.id !== conversationId));
            
            // 如果删除的是当前对话，创建新对话
            if (conversationId === currentConversationId) {
                onNewConversation();
            }
        } catch (e: any) {
            console.error('Failed to delete conversation:', e);
            alert('删除失败');
        }
    };

    // 组件挂载或可见时加载数据
    useEffect(() => {
        if (isVisible) {
            loadConversations();
        }
    }, [isVisible, loadConversations]);

    // 搜索防抖
    useEffect(() => {
        const timer = setTimeout(() => {
            searchConversations(searchQuery);
        }, 300);
        
        return () => clearTimeout(timer);
    }, [searchQuery, searchConversations]);

    // 格式化时间
    const formatTime = (isoString: string): string => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return '昨天';
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else {
            return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        }
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="chat-history-panel">
            <div className="chat-history-header">
                <h3>历史对话</h3>
                <button 
                    className="close-btn"
                    onClick={onClose}
                    title="关闭"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                    </svg>
                </button>
            </div>
            
            <div className="chat-history-search">
                <div className="search-input-wrapper">
                    <svg className="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04z"/>
                    </svg>
                    <input
                        type="text"
                        placeholder="搜索对话..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    {searchQuery && (
                        <button 
                            className="clear-search-btn"
                            onClick={() => setSearchQuery('')}
                        >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                            </svg>
                        </button>
                    )}
                </div>
            </div>
            
            <button 
                className="new-conversation-btn"
                onClick={onNewConversation}
            >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zm6.75-3.5v3h3a.75.75 0 010 1.5h-3v3a.75.75 0 01-1.5 0v-3h-3a.75.75 0 010-1.5h3v-3a.75.75 0 011.5 0z"/>
                </svg>
                <span>新建对话</span>
            </button>
            
            <div className="chat-history-list">
                {isLoading && (
                    <div className="loading-indicator">
                        <div className="spinner"></div>
                        <span>加载中...</span>
                    </div>
                )}
                
                {error && (
                    <div className="error-message">
                        <span>{error}</span>
                        <button onClick={loadConversations}>重试</button>
                    </div>
                )}
                
                {!isLoading && !error && conversations.length === 0 && (
                    <div className="empty-state">
                        <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" opacity="0.3">
                            <path d="M2.5 1A1.5 1.5 0 001 2.5v11A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0013.5 1h-11zm.25 1.5h10.5a.25.25 0 01.25.25v10.5a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25V2.75a.25.25 0 01.25-.25z"/>
                        </svg>
                        <p>{searchQuery ? '没有找到匹配的对话' : '还没有历史对话'}</p>
                    </div>
                )}
                
                {!isLoading && conversations.map((conv) => (
                    <div
                        key={conv.id}
                        className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
                        onClick={() => onSelectConversation(conv.id)}
                    >
                        <div className="conversation-icon">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5z"/>
                            </svg>
                        </div>
                        <div className="conversation-info">
                            <div className="conversation-title">{conv.title}</div>
                            <div className="conversation-meta">
                                <span className="message-count">{conv.message_count} 条消息</span>
                                <span className="time">{formatTime(conv.updated_at)}</span>
                            </div>
                        </div>
                        <button
                            className="delete-btn"
                            onClick={(e) => handleDelete(e, conv.id)}
                            title="删除对话"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"/>
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
