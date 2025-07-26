import { apiClient } from "./client";
import type { CategoryTag } from "@/types";

export const categoryTagsApi = {
  getAll: async (): Promise<CategoryTag[]> => {
    const response = await apiClient.get<CategoryTag[]>("/category-tags");
    return response.data;
  },
};
