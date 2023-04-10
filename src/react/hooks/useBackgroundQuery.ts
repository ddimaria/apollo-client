import { useMemo, useRef, useCallback } from 'react';
import {
  ApolloClient,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
  ApolloQueryResult,
  ObservableQuery,
} from '../../core';
import { compact } from '../../utilities';
import { invariant } from '../../utilities/globals';
import { useApolloClient } from './useApolloClient';
import { QuerySubscription } from '../cache/QuerySubscription';
import { useSyncExternalStore } from './useSyncExternalStore';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { useDeepMemo, useStrictModeSafeCleanupEffect, __use } from './internal';
import { useSuspenseCache } from './useSuspenseCache';
import { SuspenseCache } from '../cache';

const DEFAULT_FETCH_POLICY = 'cache-first';
const DEFAULT_SUSPENSE_POLICY = 'always';
const DEFAULT_ERROR_POLICY = 'none';

//////////////////////
// ⌘C + ⌘P from uSQ //
//////////////////////
type FetchMoreFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['fetchMore'];

type RefetchFunction<
  TData,
  TVariables extends OperationVariables
> = ObservableQueryFields<TData, TVariables>['refetch'];

interface UseWatchQueryOptionsHookOptions<
  TData,
  TVariables extends OperationVariables
> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SuspenseQueryHookOptions<TData, TVariables>;
  client: ApolloClient<any>;
}

function useTrackedSubscriptions(subscription: QuerySubscription) {
  const trackedSubscriptions = useRef(new Set<QuerySubscription>());

  trackedSubscriptions.current.add(subscription);

  return function dispose() {
    trackedSubscriptions.current.forEach((sub) => sub.dispose());
  };
}

function useWatchQueryOptions<TData, TVariables extends OperationVariables>({
  query,
  options,
  client,
}: UseWatchQueryOptionsHookOptions<TData, TVariables>): WatchQueryOptions<
  TVariables,
  TData
> {
  const { watchQuery: defaultOptions } = client.defaultOptions;

  const watchQueryOptions = useDeepMemo<
    WatchQueryOptions<TVariables, TData>
  >(() => {
    const {
      errorPolicy,
      fetchPolicy,
      suspensePolicy = DEFAULT_SUSPENSE_POLICY,
      variables,
      ...watchQueryOptions
    } = options;

    return {
      ...watchQueryOptions,
      query,
      errorPolicy:
        errorPolicy || defaultOptions?.errorPolicy || DEFAULT_ERROR_POLICY,
      fetchPolicy:
        fetchPolicy || defaultOptions?.fetchPolicy || DEFAULT_FETCH_POLICY,
      notifyOnNetworkStatusChange: suspensePolicy === 'always',
      // By default, `ObservableQuery` will run `reobserve` the first time
      // something `subscribe`s to the observable, which kicks off a network
      // request. This creates a problem for suspense because we need to begin
      // fetching the data immediately so we can throw the promise on the first
      // render. Since we don't subscribe until after we've unsuspended, we need
      // to avoid kicking off another network request for the same data we just
      // fetched. This option toggles that behavior off to avoid the `reobserve`
      // when the observable is first subscribed to.
      fetchOnFirstSubscribe: false,
      variables: compact({ ...defaultOptions?.variables, ...variables }),
    };
  }, [options, query, defaultOptions]);

  // if (__DEV__) {
  // validateOptions(watchQueryOptions);
  // }

  return watchQueryOptions;
}
/////////
// End //
/////////
export interface UseBackgroundQueryResult<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
> {
  promise: Promise<ApolloQueryResult<TData>>;
  observable: ObservableQuery<TData, TVariables>;
  fetchMore: ObservableQueryFields<TData, TVariables>['fetchMore'];
  refetch: ObservableQueryFields<TData, TVariables>['refetch'];
}

export function useBackgroundQuery_experimental<
  TData = any,
  TVariables extends OperationVariables = OperationVariables
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options: SuspenseQueryHookOptions<TData, TVariables> = Object.create(null)
): UseBackgroundQueryResult<TData> {
  const suspenseCache = useSuspenseCache();
  const client = useApolloClient(options.client);
  const watchQueryOptions = useWatchQueryOptions({ query, options, client });
  const { variables } = watchQueryOptions;

  const subscription = suspenseCache.getSubscription(
    client,
    query,
    variables,
    () => client.watchQuery(watchQueryOptions)
  );

  const dispose = useTrackedSubscriptions(subscription);
  useStrictModeSafeCleanupEffect(dispose);

  const fetchMore: FetchMoreFunction<TData, TVariables> = useCallback(
    (options) => subscription.fetchMore(options) as any,
    [subscription]
  );

  const refetch: RefetchFunction<TData, TVariables> = useCallback(
    (variables) => subscription.refetch(variables),
    [subscription]
  );

  return useMemo(() => {
    const { promise, observable } = subscription;
    return {
      promise,
      observable,
      fetchMore,
      refetch,
    };
  }, [subscription, fetchMore, refetch]);
}

export function useReadQuery<TData>(
  promise: Promise<ApolloQueryResult<TData>>,
  suspenseCache?: SuspenseCache
) {
  const _suspenseCache = suspenseCache || useSuspenseCache();
  const prevPromise = useRef(promise);

  if (prevPromise.current !== promise) {
    invariant.warn(
      'The promise you have provided is not stable across renders; this may cause `useReadQuery` to return incorrect data. If you are passing it via `options`, please ensure you are providing the same SuspenseCache to both `useBackgroundQuery` and `useReadQuery`.'
    );
  }

  prevPromise.current = promise;

  const result = __use(promise);
  const subscription = _suspenseCache.getSubscriptionFromPromise(promise);
  return useSyncExternalStore(
    subscription?.listen ||
      (() => () => {
        /* noop */
      }),
    () => subscription?.result || result,
    () => subscription?.result || result
  );
}
