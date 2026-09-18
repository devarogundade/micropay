import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { AgentInput } from '#/lib/agents-api'
import {
  createAgent,
  deleteAgent,
  pauseAgent,
  publishAgent,
  requestWithdrawal,
  updateAgent,
} from '#/lib/agents-api'
import { queryKeys } from '#/lib/query-keys'

export function invalidateAgentsQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  _wallet?: string | null,
) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.agents.all })
}

export function useCreateAgentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { walletAddress: string; agent: AgentInput }) =>
      createAgent(input),
    onSuccess: async (_agent, vars) => {
      await invalidateAgentsQueries(queryClient, vars.walletAddress)
    },
  })
}

export function useUpdateAgentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { walletAddress: string; slug: string; agent: AgentInput }) =>
      updateAgent(input),
    onSuccess: async (_agent, vars) => {
      await invalidateAgentsQueries(queryClient, vars.walletAddress)
    },
  })
}

export function usePublishAgentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { walletAddress: string; slug: string }) => publishAgent(input),
    onSuccess: async (_agent, vars) => {
      await invalidateAgentsQueries(queryClient, vars.walletAddress)
    },
  })
}

export function usePauseAgentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { walletAddress: string; slug: string }) => pauseAgent(input),
    onSuccess: async (_agent, vars) => {
      await invalidateAgentsQueries(queryClient, vars.walletAddress)
    },
  })
}

export function useDeleteAgentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { walletAddress: string; slug: string }) => deleteAgent(input),
    onSuccess: async (_result, vars) => {
      await invalidateAgentsQueries(queryClient, vars.walletAddress)
    },
  })
}

export function useRequestWithdrawalMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      walletAddress: string
      amountUsdc: number
      destinationAddress?: string
    }) => requestWithdrawal(input),
    onSuccess: async (_result, vars) => {
      await Promise.all([
        invalidateAgentsQueries(queryClient, vars.walletAddress),
        queryClient.invalidateQueries({
          queryKey: queryKeys.agents.balance(vars.walletAddress),
        }),
      ])
    },
  })
}