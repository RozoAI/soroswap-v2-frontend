import { FeeType, getFee } from "@rozoai/intent-common";
import { useQuery } from "@tanstack/react-query";
import { BRIDGE_APP_ID } from "../constants/bridge";

export interface GetFeeParams {
  amount: number;
  type?: FeeType;
  appId?: string;
  currency?: string;
  /** Destination chain id (the bridge "toChain"). */
  toChain: number;
  /** Source chain id (where the user sends from). */
  sourceChainId: number;
  preferredTokenAddress: string;
  /** Destination wallet address (receiver on the destination chain). */
  destReceiverAddress: string;
  toToken: string;
}

export interface GetFeeResponse {
  appId: string;
  amount: number;
  currency: string;
  fee: number;
  feePercentage: string;
  minimumFee: string;
  amountIn: number;
  amountOut: number;
}

export interface GetFeeError {
  error: string;
  message: string;
  received: number;
  maxAllowed: number;
}

const getFeeRequest = async (params: GetFeeParams): Promise<GetFeeResponse> => {
  const res = await getFee({
    appId: params.appId ?? BRIDGE_APP_ID,
    feeType: params.type ?? FeeType.ExactOut,
    preferredChain: params.sourceChainId,
    preferredTokenAddress: params.preferredTokenAddress,
    toUnits: String(params.amount),
    toChain: params.toChain,
    toAddress: params.destReceiverAddress,
    toToken: params.toToken,
  });

  if (res.error || !res.data) {
    throw res.error ?? new Error("Failed to fetch fee");
  }

  const data = res.data;
  const amountIn = parseFloat(data.source.amount);
  const amountOut = parseFloat(data.destination.amount);
  const fee = parseFloat(data.source.fee);

  // `amount` mirrors the user's typed input (the independent field) so the
  // caller's validity check (`feeData.amount === debouncedAmount`) holds for
  // both ExactIn (source amount) and ExactOut (destination amount).
  const amount = params.type === FeeType.ExactIn ? amountIn : amountOut;

  return {
    appId: params.appId ?? BRIDGE_APP_ID,
    amount,
    currency: params.currency ?? "",
    fee,
    feePercentage: data.feeInfo.feePercentage,
    minimumFee: data.feeInfo.minimumFee,
    amountIn,
    amountOut,
  };
};

export const useGetFee = (
  params: GetFeeParams,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  },
) => {
  return useQuery({
    queryKey: [
      "fee",
      params.amount,
      params.appId,
      params.currency,
      params.type,
      params.toChain,
      params.sourceChainId,
      params.preferredTokenAddress,
      params.destReceiverAddress,
      params.toToken,
    ],
    queryFn: () => getFeeRequest(params),
    // Only fire once the routing inputs the SDK needs are present, not just a
    // positive amount — an empty destReceiverAddress or missing chain ids would
    // otherwise trigger a doomed request on every keystroke.
    enabled:
      (options?.enabled ?? true) &&
      params.amount > 0 &&
      params.toChain > 0 &&
      params.sourceChainId > 0 &&
      !!params.destReceiverAddress,
    refetchInterval: options?.refetchInterval,
    staleTime: 30000, // 30 seconds
    retry: false, // Don't retry on error
  });
};
