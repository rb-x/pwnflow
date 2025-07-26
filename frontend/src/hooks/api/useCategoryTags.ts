import { useQuery } from "@tanstack/react-query";
import { categoryTagsApi } from "@/services/api/categoryTags";

export const categoryTagKeys = {
  all: ["categoryTags"] as const,
  lists: () => [...categoryTagKeys.all, "list"] as const,
};

export function useCategoryTags() {
  return useQuery({
    queryKey: categoryTagKeys.lists(),
    queryFn: () => categoryTagsApi.getAll(),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
}
