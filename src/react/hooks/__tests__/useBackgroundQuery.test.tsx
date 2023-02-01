import React from 'react';
// import { ErrorBoundary, ErrorBoundaryProps } from 'react-error-boundary';
import { renderHook } from '@testing-library/react';
import { gql } from '../../../core';
import { MockedProvider } from '../../../testing';
import { useBackgroundQuery_experimental as useBackgroundQuery } from '../useBackgroundQuery';
import { NetworkStatus } from '../../../core';
import { SuspenseCache } from '../../cache';

describe('useBackgroundQuery', () => {
  it('fetches a query', async () => {
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

    const observable = result.current.observable;

    // using private APIs in these tests for now
    // @ts-ignore
    expect(observable.queryInfo.networkStatus).toBe(NetworkStatus.loading);
    // @ts-ignore
    expect(suspenseCache.queries.size).toBe(1);
  });
});
