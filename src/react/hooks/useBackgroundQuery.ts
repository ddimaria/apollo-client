import { useState, useMemo } from 'react';
import {
  ApolloClient,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
  WatchQueryOptions,
} from '../../core';
import { compact } from '../../utilities';
import { useApolloClient } from './useApolloClient';
import {
  SuspenseQueryHookOptions,
  ObservableQueryFields,
} from '../types/types';
import { useDeepMemo } from './internal';
import { WrappedSuspenseCachePromise } from '../cache/SuspenseCache';
import { useSuspenseCache } from './useSuspenseCache';

const DEFAULT_FETCH_POLICY = 'cache-first';
const DEFAULT_SUSPENSE_POLICY = 'always';
const DEFAULT_ERROR_POLICY = 'none';

//////////////////////
// ⌘C + ⌘P from uSQ //
//////////////////////
interface UseWatchQueryOptionsHookOptions<
  TData,
  TVariables extends OperationVariables
> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  options: SuspenseQueryHookOptions<TData, TVariables>;
  client: ApolloClient<any>;
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
  promise: WrappedSuspenseCachePromise;
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
): UseBackgroundQueryResult<TData, TVariables> {
  const suspenseCache = useSuspenseCache();
  const client = useApolloClient(options.client);
  const watchQueryOptions = useWatchQueryOptions({ query, options, client });
  const { variables } = watchQueryOptions;


  const [observable] = useState(() => {
    return cacheEntry?.observable || client.watchQuery(watchQueryOptions);
  });


  let cacheEntry = suspenseCache.lookup(query, variables);

  if (!cacheEntry) {
    // const promise = observable.reobserve({ query, variables });
    // decorate promise before adding to the suspense cache?
    cacheEntry = suspenseCache.add(query, variables, {
      promise: observable.reobserve({ query, variables }),
      observable,
    });
  }

  const promise = cacheEntry.promise;

  // has status = 'pending'
  // console.log(promise);

  return useMemo(() => {
    return {
      promise,
      observable,
      fetchMore: (options) => {
        const promise = observable.fetchMore(options);

        suspenseCache.add(query, watchQueryOptions.variables, {
          promise,
          observable,
        });

        return promise;
      },
      refetch: (variables?: Partial<TVariables>) => {
        const promise = observable.refetch(variables);

        suspenseCache.add(query, watchQueryOptions.variables, {
          promise,
          observable,
        });

        return promise;
      },
    };
  }, [observable, promise]);
}

export function useReadQuery(promise) {
  console.log(promise);
  if (promise.status === 'pending') {
    throw promise;
  }
  if (promise.status === 'fulfilled') {
    return promise.value;
  }
  if (promise.status === 'rejected') {
    throw promise.reason;
  }
}
