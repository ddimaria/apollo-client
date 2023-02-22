import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { gql, NetworkStatus, ApolloClient } from '../../../core';
import { MockedProvider, mockSingleLink } from '../../../testing';
import { useBackgroundQuery_experimental as useBackgroundQuery } from '../useBackgroundQuery';
import { ApolloProvider } from '../../context';
import { SuspenseCache } from '../../cache';
import { InMemoryCache } from '../../../cache';

describe('useBackgroundQuery', () => {
  it('fetches a simple query with minimal config', async () => {
    const query = gql`
      query {
        hello
      }
    `;
    const suspenseCache = new SuspenseCache();
    const mocks = [
      {
        request: { query },
        result: { data: { hello: 'world 1' } },
      },
    ];
    const { result } = renderHook(() => useBackgroundQuery(query), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={mocks} suspenseCache={suspenseCache}>
          {children}
        </MockedProvider>
      ),
    });

    const { promise, observable } = result.current;

    // the result is loading
    expect(observable.getCurrentResult().loading).toBe(true);
    expect(observable.getCurrentResult().networkStatus).toBe(
      NetworkStatus.loading
    );

    // sets status on promise object
    expect(promise.status).toBe('pending');

    // once the data is fetched, loading is false and network status is ready
    await waitFor(() => {
      expect(observable.getCurrentResult().loading).toBe(false);
    });
    expect(observable.getCurrentResult().networkStatus).toBe(
      NetworkStatus.ready
    );
    expect(observable.getCurrentResult().data).toEqual({
      hello: 'world 1',
    });
  });

  describe('fetch policy behaviors', () => {
    describe('cache-and-network', () => {
      it('returns initial cache data followed by network data', async () => {
        const query = gql`
          {
            hello
          }
        `;
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        cache.writeQuery({ query, data: { hello: 'from cache' } });

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'cache-and-network' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { observable } = result.current;

        // the result is loading and initial data is in the cache
        expect(observable.getCurrentResult().loading).toBe(true);
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from cache',
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.loading
        );

        await waitFor(() => {
          expect(observable.getCurrentResult().loading).toBe(false);
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.ready
        );
        // data has been replaced by the link data
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from link',
        });
      });
    });
    describe('cache-first', () => {
      it('all data is present in the cache, no network request is made', async () => {
        const query = gql`
          {
            hello
          }
        `;
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        cache.writeQuery({ query, data: { hello: 'from cache' } });

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'cache-first' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { observable } = result.current;

        // cache data exists so the observable never enters loading state
        await waitFor(() => {
          expect(observable.getCurrentResult().loading).toBe(false);
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.ready
        );
        // cache data is returned without going to the network
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from cache',
        });
      });
      it('partial data is present in the cache so it is ignored and network request is made', async () => {
        const query = gql`
          {
            hello
            foo
          }
        `;
        // we expect a "Missing field 'foo' while writing result..." error
        // when writing hello to the cache, so we'll silence the console.error
        const originalConsoleError = console.error;
        console.error = () => {
          /* noop */
        };
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link', foo: 'bar' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        cache.writeQuery({ query, data: { hello: 'from cache' } });

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'cache-first' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { observable } = result.current;

        // the result is loading and initial data is in the cache
        expect(observable.getCurrentResult().loading).toBe(true);
        // since all requested data isn't present in the cache,
        // undefined is returned
        expect(observable.getCurrentResult().data).toEqual(undefined);
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.loading
        );

        await waitFor(() => {
          expect(observable.getCurrentResult().loading).toBe(false);
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.ready
        );
        // data has been replaced by the link data
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from link',
          foo: 'bar',
        });
        console.error = originalConsoleError;
        expect(client.cache.extract()).toEqual({
          ROOT_QUERY: { __typename: 'Query', hello: 'from link', foo: 'bar' },
        });
      });
    });
    describe('network-only', () => {
      it('existing data in the cache is ignored', async () => {
        const query = gql`
          {
            hello
          }
        `;
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        cache.writeQuery({ query, data: { hello: 'from cache' } });

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'network-only' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { observable } = result.current;

        expect(observable.getCurrentResult().loading).toBe(true);
        // do not return initial cache data with network-only fetch policy
        expect(observable.getCurrentResult().data).toEqual(undefined);
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.loading
        );

        await waitFor(() => {
          expect(observable.getCurrentResult().loading).toBe(false);
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.ready
        );
        // data has been replaced by the link data
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from link',
        });
        expect(client.cache.extract()).toEqual({
          ROOT_QUERY: { __typename: 'Query', hello: 'from link' },
        });
      });
    });
    describe('no-cache', () => {
      it('fetches data from the network but does not update the cache', async () => {
        const query = gql`
          {
            hello
          }
        `;
        const suspenseCache = new SuspenseCache();
        const cache = new InMemoryCache();
        const link = mockSingleLink({
          request: { query },
          result: { data: { hello: 'from link' } },
          delay: 20,
        });

        const client = new ApolloClient({
          link,
          cache,
        });

        cache.writeQuery({ query, data: { hello: 'from cache' } });

        const { result } = renderHook(
          () => useBackgroundQuery(query, { fetchPolicy: 'no-cache' }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider suspenseCache={suspenseCache} client={client}>
                {children}
              </ApolloProvider>
            ),
          }
        );

        const { promise, observable } = result.current;

        // the result is loading and initial data is in the cache
        expect(observable.getCurrentResult().loading).toBe(true);
        expect(observable.getCurrentResult().data).toEqual(undefined);
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.loading
        );

        await waitFor(() => {
          expect(observable.getCurrentResult().loading).toBe(false);
        });
        expect(observable.getCurrentResult().networkStatus).toBe(
          NetworkStatus.ready
        );

        expect(promise.status).toBe('fulfilled');

        // data has been replaced by the link data
        expect(observable.getCurrentResult().data).toEqual({
          hello: 'from link',
        });
        // ...but not updated in the cache
        expect(client.cache.extract()).toEqual({
          ROOT_QUERY: { __typename: 'Query', hello: 'from cache' },
        });
      });
    });
  });
});
