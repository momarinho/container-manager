import { apiClient } from './apiClient';
import type { ApiSuccess } from '../../../shared/types/api';
import type { User } from '../types/user.types';

export const usersService = {
  /**
   * List all registered users
   */
  async list(): Promise<User[]> {
    const response = await apiClient.get<ApiSuccess<User[]>>('/users');
    return response.data.data;
  },

  /**
   * Create a new user
   */
  async create(username: string, password_plain: string): Promise<User> {
    const response = await apiClient.post<ApiSuccess<User>>('/users', {
      username,
      password: password_plain,
    });
    return response.data.data;
  },

  /**
   * Delete a user by username
   */
  async delete(username: string): Promise<void> {
    await apiClient.delete(`/users/${username}`);
  },
};
