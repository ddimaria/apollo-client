import {
  ApolloQueryResult,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
  TypedDocumentNode,
} from '../../core';
import { canonicalStringify } from '../../cache';

interface CacheEntry<TData, TVariables extends OperationVariables> {
  observable: ObservableQuery<TData, TVariables>;
  fulfilled: boolean;
  promise: Promise<ApolloQueryResult<TData>>;
}

enum PromiseStatus {
  pending = 'pending',
  fulfilled = 'fulfilled',
  rejected = 'rejected',
}

interface WrappedPendingPromise<TData> extends Promise<ApolloQueryResult<TData>> {
  status: PromiseStatus.pending;
  value?: never;
  reason?: never;
}

interface WrappedFulfilledPromise<TData> extends Promise<ApolloQueryResult<TData>> {
  status: PromiseStatus.fulfilled;
  value: TData;
  reason?: never;
}

interface WrappedRejectedPromise<TData> extends Promise<ApolloQueryResult<TData>> {
  status: PromiseStatus.rejected;
  value?: TData; // can we have partial data here?
  reason: any;
}

export type WrappedSuspenseCachePromise<TData = any> =
  | WrappedPendingPromise<TData>
  | WrappedFulfilledPromise<TData>
  | WrappedRejectedPromise<TData>;

// function decoratePromise<TData>(
//   promise: Promise<ApolloQueryResult<TData>>
// ): WrappedSuspenseCachePromise<TData> {
//   promise.status = PromiseStatus.pending;
//   return promise;
// }

export class SuspenseCache {
  private queries = new Map<
    DocumentNode,
    Map<string, CacheEntry<unknown, any>>
  >();

  add<TData = any, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables | undefined,
    {
      promise,
      observable,
    }: {
      promise: Promise<ApolloQueryResult<TData>> & WrappedSuspenseCachePromise<TData>;
      observable: ObservableQuery<TData, TVariables>;
    }
  ) {
    const variablesKey = this.getVariablesKey(variables);
    const map = this.queries.get(query) || new Map();

    promise.status = PromiseStatus.pending;
    promise
      .then((result) => {
        promise.value = result;
        promise.observable = observable;
      })
      .catch(() => {
        // Throw away the error as we only care to track when the promise has
        // been fulfilled
        promise.status = PromiseStatus.rejected;
      })
      .finally(() => {
        promise.status = PromiseStatus.fulfilled;
        entry.fulfilled = true;
      });

    const entry: CacheEntry<TData, TVariables> = {
      observable,
      fulfilled: false,
      promise,
    };

    map.set(variablesKey, entry);

    this.queries.set(query, map);

    return entry;
  }

  lookup<
    TData = any,
    TVariables extends OperationVariables = OperationVariables
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    variables: TVariables | undefined
  ): CacheEntry<TData, TVariables> | undefined {
    return this.queries
      .get(query)
      ?.get(this.getVariablesKey(variables)) as CacheEntry<TData, TVariables>;
  }

  remove(query: DocumentNode, variables: OperationVariables | undefined) {
    const map = this.queries.get(query);

    if (!map) {
      return;
    }

    const key = this.getVariablesKey(variables);
    const entry = map.get(key);

    if (entry && !entry.observable.hasObservers()) {
      map.delete(key);
    }

    if (map.size === 0) {
      this.queries.delete(query);
    }
  }

  private getVariablesKey(variables: OperationVariables | undefined) {
    return canonicalStringify(variables || Object.create(null));
  }
}
