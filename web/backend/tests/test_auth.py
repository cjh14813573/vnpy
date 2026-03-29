"""认证模块测试"""

import pytest


class TestAuthLogin:
    """登录接口测试"""

    def test_login_success(self, client):
        """正确凭据登录成功"""
        resp = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["username"] == "admin"
        assert data["role"] == "admin"
        assert data["expires_in"] > 0

    def test_login_wrong_password(self, client):
        """密码错误返回 401"""
        resp = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "wrong_password",
        })
        assert resp.status_code == 401
        assert "用户名或密码错误" in resp.json()["detail"]

    def test_login_wrong_username(self, client):
        """用户不存在返回 401"""
        resp = client.post("/api/auth/login", json={
            "username": "nonexistent",
            "password": "admin123",
        })
        assert resp.status_code == 401

    def test_login_remember_me(self, client):
        """记住登录的 token 有效期更长"""
        resp = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin123",
            "remember_me": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["expires_in"] == 7 * 86400  # 7天


class TestAuthMe:
    """当前用户接口测试"""

    def test_me_authenticated(self, client, auth_headers):
        """登录后能获取用户信息"""
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "admin"
        assert data["role"] == "admin"

    def test_me_unauthenticated(self, client):
        """未登录返回 401"""
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_invalid_token(self, client):
        """无效 token 返回 401"""
        resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"})
        assert resp.status_code == 401


class TestAuthPassword:
    """修改密码测试"""

    def test_change_password_success(self, client, auth_headers):
        """正确修改密码"""
        resp = client.put("/api/auth/password", json={
            "old_password": "admin123",
            "new_password": "newpass456",
        }, headers=auth_headers)
        assert resp.status_code == 200

        # 用新密码登录
        resp = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "newpass456",
        })
        assert resp.status_code == 200

        # 恢复密码
        client.put("/api/auth/password", json={
            "old_password": "newpass456",
            "new_password": "admin123",
        }, headers=auth_headers)

    def test_change_password_wrong_old(self, client, auth_headers):
        """原密码错误"""
        resp = client.put("/api/auth/password", json={
            "old_password": "wrong",
            "new_password": "newpass",
        }, headers=auth_headers)
        assert resp.status_code == 400
