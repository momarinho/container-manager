import { useQuery } from "@tanstack/react-query";
import { stacksService } from "../../services/stacks.service";
import type { StackInfo } from "../../types/stack.types";

export const STACKS_QUERY_KEY = ["stacks"] as const;

export function useStacksQuery() {
  return useQuery<StackInfo[]>({
    queryKey: STACKS_QUERY_KEY,
    queryFn: () => stacksService.listStacks(),
    refetchInterval: 5000,
  });
}
