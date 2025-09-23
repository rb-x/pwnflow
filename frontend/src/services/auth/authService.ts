import { apiClient } from "../api/client";
import type { User, UserCreate, Token } from "@/types";

class AuthService {
  private tokenKey = "pwnflow_token";

  async login(username: string, password: string): Promise<User> {
    // OAuth2 compatible form data
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);
    formData.append("grant_type", "password");

    const response = await apiClient.post<Token>(
      "/auth/login/access-token",
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    this.setToken(response.data.access_token);

    // Get user info after login
    return this.getCurrentUser();
  }

  async register(data: UserCreate): Promise<User> {
    const response = await apiClient.post<User>("/auth/register", data);
    // Auto-login after registration
    await this.login(data.username, data.password);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const token = this.getToken();
    if (!token) {
      throw new Error("No token found");
    }

    try {
      const response = await apiClient.get<User>("/auth/me");
      return response.data;
    } catch (error) {
      // If /me endpoint fails, throw error to trigger re-login
      throw new Error("Failed to get user information");
    }
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    try {
      const response = await apiClient.put<User>("/auth/me", data);
      return response.data;
    } catch (error: any) {
      // Check if email was changed (401 with special header)
      if (
        error.response?.status === 401 &&
        error.response?.headers?.["x-email-changed"]
      ) {
        // Force logout for re-authentication
        this.logout();
        throw new Error(
          "Email changed. Please login with your new credentials."
        );
      }
      throw error;
    }
  }

  async changePassword(
    _currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Password change always requires re-login for security
    // Note: currentPassword is not used in the current API implementation
    await apiClient.put("/auth/me", { password: newPassword });
    this.logout();
  }

  async logout() {
    try {
      // Call backend logout to blacklist the token
      await apiClient.post("/auth/logout");
    } catch (error) {
      // Even if backend call fails, we still want to clear local state
      console.error("Logout API call failed:", error);
    } finally {
      // Clear local storage and redirect
      localStorage.removeItem(this.tokenKey);
      window.location.href = "/login";
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string) {
    localStorage.setItem(this.tokenKey, token);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();
