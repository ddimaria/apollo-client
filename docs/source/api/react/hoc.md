---
title: 'HOC'
sidebar_title: 'HOC (deprecated)'
description: Deprecated React Apollo HOC API
---

> **NOTE:** React Apollo's higher order components have been deprecated. They will continue to receive bug fixes until March 2020, after which they will no longer be maintained by Apollo.

## Installation

```
npm install @apollo/react-hoc
```

## `graphql(query, [config])(component)`

```js
import { graphql } from '@apollo/react-hoc';
```

The `graphql()` function is the most important thing exported by the `@apollo/react-hoc` package. With this function you can create higher-order components that can execute queries and update reactively based on the data in your Apollo store. The `graphql()` function returns a function which will “enhance” any component with reactive GraphQL capabilities. This follows the React [higher-order component](https://facebook.github.io/react/docs/higher-order-components.html) pattern which is also used by [`react-redux`’s `connect`](https://github.com/reduxjs/react-redux/blob/master/docs/api/connect.md) function.

The `graphql()` function may be used like this:

```js
function TodoApp({ data: { todos } }) {
  return (
    <ul>
      {todos.map(({ id, text }) => (
        <li key={id}>{text}</li>
      ))}
    </ul>
  );
}

export default graphql(gql`
  query TodoAppQuery {
    todos {
      id
      text
    }
  }
`)(TodoApp);
```

You may also define an intermediate function and hook up your component with the `graphql()` function like this:

```js
// Create our enhancer function.
const withTodoAppQuery = graphql(gql`query TodoAppQuery { ... }`);

// Enhance our component.
const TodoAppWithData = withTodoAppQuery(TodoApp);

// Export the enhanced component.
export default TodoAppWithData;
```

The `graphql()` function will only be able to provide access to your GraphQL data if there is a [`<ApolloProvider/>`](./hooks/#the-apolloprovider-component) component higher up in your tree to provide an [`ApolloClient`](../core/ApolloClient/) instance that will be used to fetch your data.

The behavior of your component enhanced with the `graphql()` function will be different depending on if your GraphQL operation is a [query](../../data/queries/), a [mutation](../../data/mutations/), or a [subscription](../../data/subscriptions/). Go to the appropriate API documentation for more information about the functionality and available options for each type.

Before we look into the specific behaviors of each operation, let us look at the `config` object. The `config` object is the second argument you pass into the `graphql()` function, after your GraphQL document. The config is optional and allows you to add some custom behavior to your higher order component.

```js
export default graphql(
  gql`query MyQuery { ... }`,
  config, // <- The `config` object.
)(MyComponent);
```

Lets go through all of the properties that may live on your `config` object.

### `config.options`

`config.options` is an object or a function that allows you to define the specific behavior your component should use in handling your GraphQL data.

The specific options available for configuration depend on the operation you pass as the first argument to `graphql()`. There are options specific to [queries](../../data/queries/) and [mutations](../../data/mutations/).

You can define `config.options` as a plain object, or you can compute your options from a function that takes the component’s props as an argument.

**Example:**

```js
export default graphql(gql`query MyQuery { ... }`, {
  options: {
    // Options go here.
  },
})(MyComponent);
```

```js
export default graphql(gql`query MyQuery { ... }`, {
  options: props => ({
    // Options are computed from `props` here.
  }),
})(MyComponent);
```

### `config.props`

The `config.props` property allows you to define a map function that takes the `props` (and optionally `lastProps`) added by the `graphql()` function ([`props.data`](#propsdata) for queries and [`props.mutate`](#propsmutate) for mutations) and allows you to compute a new `props` (and optionally `lastProps`) object that will be provided to the component that `graphql()` is wrapping.

The function you define behaves almost exactly like [`mapProps` from Recompose](https://github.com/acdlite/recompose/blob/2e71fdf4270cc8022a6574aaf00731bfc25dcae6/docs/API.md#mapprops) providing the same benefits without the need for another library.

`config.props` is most useful when you want to abstract away complex functions calls into a simple prop that you can pass down to your component.

Another benefit of `config.props` is that it also allows you to decouple your pure UI components from your GraphQL and Apollo concerns. You can write your pure UI components in one file and then keep the logic required for them to interact with the store in a completely different place in your project. You can accomplish this by your pure UI components only asking for the props needed to render and `config.props` can contain the logic to provide exactly the props your pure component needs from the data provided by your GraphQL API.

**Example:**

This example uses [`props.data.fetchMore`](#datafetchmoreoptions).

```js
export default graphql(gql`query MyQuery { ... }`, {
  props: ({ data: { fetchMore } }) => ({
    onLoadMore: () => {
      fetchMore({ ... });
    },
  }),
})(MyComponent);

function MyComponent({ onLoadMore }) {
  return (
    <button onClick={onLoadMore}>
      Load More!
    </button>
  );
}
```

To access props that are not added by the `graphql()` function, use the `ownProps` keyword. For example:

```js
export default graphql(gql`query MyQuery { ... }`, {
  props: ({ data: { liveImage }, ownProps: { loadingImage } }) => ({
    image: liveImage || loadingImage,
  }),
})(MyComponent);
```

To access `lastProps`, use the second argument of `config.props`. For example:

```js
export default graphql(gql`query MyQuery { ... }`, {
  props: ({ data: { liveImage } }, lastProps) => ({
    image: liveImage,
    lastImage: lastProps.data.liveImage,
  }),
})(MyComponent);
```

### `config.skip`

If `config.skip` is true then all of the React Apollo code will be skipped _entirely_. It will be as if the `graphql()` function were a simple identity function. Your component will behave as if the `graphql()` function were not there at all.

Instead of passing a boolean to `config.skip`, you may also pass a function to `config.skip`. The function will take your components props and should return a boolean. If the boolean returns true then the skip behavior will go into effect.

`config.skip` is especially useful if you want to use a different query based on some prop. You can see this in an example below.

**Example:**

```js
export default graphql(gql`query MyQuery { ... }`, {
  skip: props => !!props.skip,
})(MyComponent);
```

The following example uses the [`compose`](https://github.com/acdlite/recompose/blob/master/docs/API.md#compose) function to use multiple `graphql()` enhancers at once.

```js
export default compose(
  graphql(gql`query MyQuery1 { ... }`, { skip: props => !props.useQuery1 }),
  graphql(gql`query MyQuery2 { ... }`, { skip: props => props.useQuery1 }),
)(MyComponent);

function MyComponent({ data }) {
  // The data may be from `MyQuery1` or `MyQuery2` depending on the value
  // of the prop `useQuery1`.
  console.log(data);
}
```

### `config.name`

This property allows you to configure the name of the prop that gets passed down to your component. By default if the GraphQL document you pass into `graphql()` is a query then your prop will be named [`data`](#propsdata). If you pass a mutation then your prop will be named [`mutate`](#propsmutate). While appropriate these default names collide when you are trying to use multiple queries or mutations with the same component. To avoid collisions you may use `config.name` to provide the prop from each query or mutation HOC a new name.

**Example:**

This example uses the [`compose`](https://github.com/acdlite/recompose/blob/master/docs/API.md#compose) function to use multiple `graphql()` HOCs together.

```js
export default compose(
  graphql(gql`mutation CreateTodoMutation (...) { ... }`, { name: 'createTodo' }),
  graphql(gql`mutation UpdateTodoMutation (...) { ... }`, { name: 'updateTodo' }),
  graphql(gql`mutation DeleteTodoMutation (...) { ... }`, { name: 'deleteTodo' }),
)(MyComponent);

function MyComponent(props) {
  // Instead of the default prop name, `mutate`,
  // we have three different prop names.
  console.log(props.createTodo);
  console.log(props.updateTodo);
  console.log(props.deleteTodo);

  return null;
}
```

### `config.withRef`

By setting `config.withRef` to true you will be able to get the instance of your wrapped component from your higher-order GraphQL component using a `getWrappedInstance` method available on the instance of your higher-order GraphQL component.

You may want to set this to true when you want to call functions or get access to properties that are defined on your wrapped component’s class instance.

Below you can see an example of this behavior.

**Example:**

This example uses the [React `ref` feature](https://facebook.github.io/react/docs/refs-and-the-dom.html).

```js
class MyComponent extends Component {
  saySomething() {
    console.log('Hello, world!');
  }

  render() {
    // ...
  }
}

const MyGraphQLComponent = graphql(gql`query MyQuery { ... }`, { withRef: true })(
  MyComponent,
);

class MyContainerComponent extends Component {
  render() {
    return (
      <MyGraphQLComponent
        ref={component => {
          const wrappedInstance = component.getWrappedInstance();
          assert(wrappedInstance instanceof MyComponent);
          // We can call methods on the component class instance.
          wrappedInstance.saySomething();
        }}
      />
    );
  }
}
```

### `config.alias`

By default the display name for React Apollo components is `Apollo(${WrappedComponent.displayName})`. This is a pattern used by most React libraries that make use of higher order components. However, it may get a little confusing when you are using more than one higher order component and you look at the [React Devtools](https://camo.githubusercontent.com/42385f70ef638c48310ce01a675ceceb4d4b84a9/68747470733a2f2f64337676366c703535716a6171632e636c6f756466726f6e742e6e65742f6974656d732f30543361333532443366325330423049314e31662f53637265656e25323053686f74253230323031372d30312d3132253230617425323031362e33372e30302e706e673f582d436c6f75644170702d56697369746f722d49643d626536623231313261633434616130636135386432623562616265373336323626763d3236623964363434).

To configure the name of your higher order component wrapper, you may use the `config.alias` property. So for example, if you set `config.alias` to `'withCurrentUser'` your wrapper component display name would be `withCurrentUser(${WrappedComponent.displayName})` instead of `Apollo(${WrappedComponent.displayName})`.

**Example:**

This example uses the [`compose`](https://github.com/acdlite/recompose/blob/master/docs/API.md#compose) function to use multiple `graphql()` HOCs together.

```js
export default compose(
  graphql(gql`query MyQuery { ... }`, { alias: 'withCurrentUser' }),
  graphql(gql`query MyQuery { ... }`, { alias: 'withList' }),
)(MyComponent);
```

## `graphql() options for queries`

### `props.data`

The higher-order component created when using `graphql()` will feed a `data` prop into your component. Like so:

```js
render() {
  const { data } = this.props; // <- The `data` prop.
}
```

The `data` prop contains the data fetched from your query in addition to some other useful information and functions to control the lifecycle of your GraphQL-connected component. So for example, if we had a query that looked like:

```graphql
query ViewerAndTodos {
  viewer {
    name
  }
  todos {
    text
  }
}
```

Your `data` prop would contain that data:

```js
render() {
  const { data } = this.props;

  console.log(data.viewer); // <- The data returned by your query for `viewer`.
  console.log(data.todos); // <- The data returned by your query for `todos`.
}
```

The `data` prop has some other useful properties which can be accessed directly from `data`. For example, `data.loading` or `data.error`. These properties are documented below.

Make sure to always check `data.loading` and `data.error` in your components before rendering. Properties like `data.todos` which contain your app’s data may be undefined while your component is performing its initial fetch. Checking `data.loading` and `data.error` helps you avoid any issues with undefined data. Such checks may look like:

```js
render() {
  const { data: { loading, error, todos } } = this.props;
  if (loading) {
    return <p>Loading...</p>;
  }
  if (error) {
    return <p>Error!</p>;
  }
  return (
    <ul>
      {todos.map(({ id, text }) => (
        <li key={id}>{text}</li>
      ))}
    </ul>
  );
}
```

### `data.loading`

A boolean representing whether or not a query request is currently in flight for this component. This means that a query request has been sent using your network interface, and we have not yet gotten a response back. Use this property to render a loading component.

However, just because `data.loading` is true it does not mean that you won’t have data. For instance, if you already have `data.todos`, but you want to get the latest todos from your API `data.loading` might be true, but you will still have the todos from your previous request.

There are multiple different network states that your query may be in. If you want to see what the network state of your component is in more detail then refer to [`data.networkStatus`](#datanetworkstatus).

**Example:**

```js
function MyComponent({ data: { loading } }) {
  if (loading) {
    return <div>Loading...</div>;
  } else {
    // ...
  }
}

export default graphql(gql`query MyQuery { ... }`)(MyComponent);
```

### `data.error`

If an error occurred then this property will be an instance of `ApolloError`. If you do not handle this error you will get a warning in your console that says something like: `"Unhandled (in react-apollo) Error: ..."`.

**Example:**

```js
function MyComponent({ data: { error } }) {
  if (error) {
    return <div>Error!</div>;
  } else {
    // ...
  }
}

export default graphql(gql`query MyComponentQuery  { ... }`)(MyComponent);
```

### `data.networkStatus`

`data.networkStatus` is useful if you want to display a different loading indicator (or no indicator at all) depending on your network status as it provides a more detailed view into the state of a network request on your component than [`data.loading`](#dataloading) does. `data.networkStatus` is an enum with different number values between 1 and 8. These number values each represent a different network state.

1. `loading`: The query has never been run before and the request is now pending. A query will still have this network status even if a result was returned from the cache, but a query was dispatched anyway.
2. `setVariables`: If a query’s variables change and a network request was fired then the network status will be `setVariables` until the result of that query comes back. React users will see this when [`options.variables`](#optionsvariables) changes on their queries.
3. `fetchMore`: Indicates that `fetchMore` was called on this query and that the network request created is currently in flight.
4. `refetch`: It means that `refetch` was called on a query and the refetch request is currently in flight.
5. Unused.
6. `poll`: Indicates that a polling query is currently in flight. So for example if you are polling a query every 10 seconds then the network status will switch to `poll` every 10 seconds whenever a poll request has been sent but not resolved.
7. `ready`: No request is in flight for this query, and no errors happened. Everything is OK.
8. `error`: No request is in flight for this query, but one or more errors were detected.

If the network status is less then 7 then it is equivalent to [`data.loading`](#dataloading) being true. In fact you could replace all of your `data.loading` checks with `data.networkStatus < 7` and you would not see a difference. It is recommended that you use `data.loading`, however.

**Example:**

```js
function MyComponent({ data: { networkStatus } }) {
  if (networkStatus === 6) {
    return <div>Polling!</div>;
  } else if (networkStatus < 7) {
    return <div>Loading...</div>;
  } else {
    // ...
  }
}

export default graphql(gql`query MyComponentQuery  { ... }`)(MyComponent);
```

### `data.variables`

The variables that Apollo used to fetch data from your GraphQL endpoint. This property is helpful if you want to render some information based on the variables that were used to make a request against your server.

**Example:**

```js
function MyComponent({ data: { variables } }) {
  return (
    <div>
      Query executed with the following variables:
      <code>{JSON.stringify(variables)}</code>
    </div>
  );
}

export default graphql(gql`query MyComponentQuery  { ... }`)(MyComponent);
```

### `data.refetch(variables)`

Forces your component to refetch the query you defined in the `graphql()` function. This method is helpful when you want to reload the data in your component, or retry a fetch after an error.

`data.refetch` returns a promise that resolves with the new data fetched from your API once the query has finished executing. The promise will reject if the query failed.

The `data.refetch` function takes a single `variables` object argument. The `variables` argument will replace `variables` used with either the `query` option or the query from your `graphql()` HOC (depending on whether or not you specified a `query`) option to refetch the query you defined in the `graphql()` function.

**Example:**

```js
function MyComponent({ data: { refetch } }) {
  return <button onClick={() => refetch()}>Reload</button>;
}

export default graphql(gql`query MyComponentQuery  { ... }`)(MyComponent);
```

### `data.fetchMore(options)`

The `data.fetchMore` function allows you to do pagination with your query component. To learn more about pagination with `data.fetchMore`, be sure to read the [pagination documentation](../../pagination/overview/).

`data.fetchMore` returns a promise that resolves once the query executed to fetch more data has resolved.

The `data.fetchMore` function takes a single `options` object argument. The `options` argument may take the following properties:

- `[query]`: This is an optional GraphQL document created with the `gql` GraphQL tag. If you specify a `query` then that query will be fetched when you call `data.fetchMore`. If you do not specify a `query`, then the query from your `graphql()` HOC will be used.
- `[variables]`: The optional variables you may provide that will be used with either the `query` option or the query from your `graphql()` HOC (depending on whether or not you specified a `query`).
- `updateQuery(previousResult, { fetchMoreResult, variables })`: This is the required function you define that will actually update your paginated list. The first argument, `previousResult`, will be the previous data returned by the query you defined in your `graphql()` function. The second argument is an object with two properties, `fetchMoreResult` and `variables`. `fetchMoreResult` is the data returned by the new fetch that used the `query` and `variables` options from `data.fetchMore`. `variables` are the variables that were used when fetching more data. Using these arguments you should return a new data object with the same shape as the GraphQL query you defined in your `graphql()` function. See an example of this below, and also make sure to read the [pagination documentation](../../pagination/overview/).

**Example:**

```js
data.fetchMore({
  updateQuery: (previousResult, { fetchMoreResult, variables }) => {
    return {
      ...previousResult,
      // Add the new feed data to the end of the old feed data.
      feed: [...previousResult.feed, ...fetchMoreResult.feed],
    };
  },
});
```

### `data.subscribeToMore(options)`

This function will set up a subscription, triggering updates whenever the server sends a subscription publication. This requires subscriptions to be set up on the server to properly work. Check out the [subscriptions guide](../../data/subscriptions/) and the [subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws) and [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions) for more information on getting this set up.

This function returns an `unsubscribe` function handler which can be used to unsubscribe later.

A common practice is to wrap the `subscribeToMore` call within `getDerivedStateFromProps` and perform the subscription after the original query has completed. To ensure the subscription isn't created multiple times, you can add it to component state. See the example for more details.

- `[document]`: Document is a required property that accepts a GraphQL subscription created with the `gql` template string tag. It should contain a single GraphQL subscription operation with the data that will be returned.
- `[variables]`: The optional variables you may provide that will be used with the `document` option.
- `[updateQuery]`: An optional function that runs every time the server sends an update. This modifies the results of the HOC query. The first argument, `previousResult`, will be the previous data returned by the query you defined in your `graphql()` function. The second argument is an object with two properties. `subscriptionData` is result of the subscription. `variables` is the variables object used with the subscription query. Using these arguments you should return a new data object with the same shape as the GraphQL query you defined in your `graphql()` function. This is similar to the [`fetchMore`](#datafetchmoreoptions) callback.
- `[onError]`: An optional error callback.

In order to update the query's store with the result of the subscription, you must specify either the `updateQuery` option in `subscribeToMore` or the `reducer` option in your `graphql()` function.

**Example:**

```js
class SubscriptionComponent extends Component {
  state = {
    subscriptionParam: null,
    unsubscribe: null,
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    if (!nextProps.data.loading) {
      // Check for existing subscription
      if (prevState.unsubscribe) {
        // Only unsubscribe/update state if subscription variable has changed
        if (prevState.subscriptionParam === nextProps.subscriptionParam) {
          return null;
        }
        prevState.unsubscribe();
      }

      return {
        // Subscribe
        unsubscribe: nextProps.data.subscribeToMore({
          document: gql`subscription MySubscription {...}`,
          variables: {
            param: nextProps.subscriptionParam,
          },
          updateQuery: (previousResult, { subscriptionData, variables }) => {
            // Perform updates on previousResult with subscriptionData
            return updatedResult;
          },
        }),
        // Store subscriptionParam in state for next update
        subscriptionParam: nextProps.subscriptionParam,
      };
    }

    return null;
  }

  render() {
    ...
  }
}
```

### `data.startPolling(interval)`

This function will set up an interval and send a fetch request every time that interval ellapses. The function takes only one integer argument which allows you to configure how often you want your query to be executed in milliseconds. In other words, the `interval` argument represents the milliseconds between polls.

Polling is a good way to keep the data in your UI fresh. By refetching your data every 5,000 milliseconds (or 5 seconds, for example) you may effectively emulate realtime data without needing to build up a realtime backend.

If you call `data.startPolling` when your query is already polling then the current polling process will be cancelled and a new process will be started with the interval you specified.

You may also use [`options.pollInterval`](#optionspollinterval) to start polling immediately after your component mounts. It is recommend that you use `options.pollInterval` if you don’t need to arbitrarily start and stop polling.

If you set your `interval` to 0 then that means no polling instead of executing a request every JavaScript event loop tick.

**Example:**

```js
class MyComponent extends Component {
  componentDidMount() {
    // In this specific case you may want to use `options.pollInterval` instead.
    this.props.data.startPolling(1000);
  }

  render() {
    // ...
  }
}

export default graphql(gql`query MyComponentQuery { ... }`)(MyComponent);
```

### `data.stopPolling()`

By calling this function you will stop any current polling process. Your query will not start polling again until you call `data.startPolling`.

**Example:**

```js
class MyComponent extends Component {
  render() {
    return (
      <div>
        <button
          onClick={() => {
            this.props.data.startPolling(1000);
          }}
        >
          Start Polling
        </button>
        <button
          onClick={() => {
            this.props.data.stopPolling();
          }}
        >
          Stop Polling
        </button>
      </div>
    );
  }
}

export default graphql(gql`query MyComponentQuery  { ... }`)(MyComponent);
```

### `data.updateQuery(updaterFn)`

This function allows you to update the data for your query outside of the context of any mutation, subscription, or fetch. This function only takes a single argument which will be another function. The argument function has the following signature:

```
(previousResult, { variables }) => nextResult
```

The first argument will be the data for your query that currently exists in the store, and you are expected to return a new data object with the same shape. That new data object will be written to the store and any components tracking that data will be updated reactively.

The second argument is an object with a single property, `variables`. The `variables` property allows you to see what variables were used when reading the `previousResult` from the store.

This method will _not_ update anything on the server. It will only update data in your client cache and if you reload your JavaScript environment then your update will disappear.

**Example:**

```js
data.updateQuery(previousResult => ({
  ...previousResult,
  count: previousResult.count + 1,
}));
```

### `config.options`

An object or function that returns an object of options that are used to configure how the query is fetched and updated.

If `config.options` is a function then it will take the component’s props as its first argument.

The options available for use in this object depend on the operation type you pass in as the first argument to `graphql()`. The references below will document which options are available when your operation is a query. To see what other options are available for different operations, see the generic documentation for [`config.options`](#configoptions).

**Example:**

```js
export default graphql(gql`query MyQuery { ... }`, {
  options: {
    // Options go here.
  },
})(MyComponent);
```

```js
export default graphql(gql`query MyQuery { ... }`, {
  options: props => ({
    // Options are computed from `props` here.
  }),
})(MyComponent);
```

### `options.variables`

The variables that will be used when executing the query operation. These variables should correspond with the variables that your query definition accepts. If you define `config.options` as a function then you may compute your variables from your props.

**Example:**

```js
export default graphql(
  gql`
  query MyQuery ($width: Int!, $height: Int!) {
    ...
  }
`,
  {
    options: props => ({
      variables: {
        width: props.size,
        height: props.size,
      },
    }),
  },
)(MyComponent);
```

### `options.fetchPolicy`

The fetch policy is an option that allows you to specify how you want your component to interact with the Apollo Client cache. By default, your component will try to read from the cache first, and if the full data for your query is in the cache then Apollo simply returns the data from the cache. If the full data for your query is _not_ in the cache then Apollo will execute your request using your network interface. By changing this option you can change this behavior.

For a list of supported fetch policies, see [Setting a fetch policy](../../data/queries/#setting-a-fetch-policy).

**Example:**

```js
export default graphql(gql`query MyQuery { ... }`, {
  options: { fetchPolicy: 'cache-and-network' },
})(MyComponent);
```

### `options.errorPolicy`

The error policy is an option which allows you to specify how you want your component to handle errors that can happen when fetching data from GraphQL. There are two types of errors that can happen during your request; a runtime error on the client or server which results in no data, or some GraphQL errors which may be delivered alongside actual data. In order to control how your UI interacts with these errors, you can use the error policy to tell Apollo when you want to know about GraphQL Errors or not!

Valid `errorPolicy` values are:

- `none`: This is the default value where we treat GraphQL errors as runtime errors. Apollo will discard any data that came back with the request and render your component with an `error` prop.
- `ignore`: Much like `none`, this causes Apollo to ignore any data from your server, but it also won't update your UI aside from setting the loading state back to false.
- `all`: Selecting all means you want to be notified any time there are any GraphQL errors. It will render your component with any data from the request and any errors with their information. It is particularly helpful for server side rendering so your UI always shows something

**Example:**

```js
export default graphql(gql`query MyQuery { ... }`, {
  options: { errorPolicy: 'all' },
})(MyComponent);
```

### `options.pollInterval`

The interval in milliseconds at which you want to start polling. Whenever that number of milliseconds elapses your query will be executed using the network interface and another execution will be scheduled using the configured number of milliseconds.

This option will start polling your query immediately when the component mounts. If you want to start and stop polling dynamically then you may use [`data.startPolling`](#datastartpollinginterval) and [`data.stopPolling`](#datastoppolling).

If you set `options.pollInterval` to 0 then that means no polling instead of executing a request every JavaScript event loop tick.

**Example:**

```js
export default graphql(gql`query MyQuery { ... }`, {
  options: { pollInterval: 5000 },
})(MyComponent);
```

### `options.notifyOnNetworkStatusChange`

Whether or not updates to the network status or network error should trigger re-rendering of your component.

The default value is `false`.

**Example:**

```js
export default graphql(gql`query MyQuery { ... }`, {
  options: { notifyOnNetworkStatusChange: true },
})(MyComponent);
```

### `options.context`

With the flexibility and power of [Apollo Link](../../networking/advanced-http-networking/) being part of Apollo Client, you may want to send information from your operation straight to a link in your network chain! This can be used to do things like set `headers` on HTTP requests from props, control which endpoint you send a query to, and so much more depending on what links your app is using. Everything under the `context` object gets passed directly to your network chain. For more information about using context, check out the [`HttpLink` context docs](../../networking/advanced-http-networking/)

### `partialRefetch`

If `true`, perform a query `refetch` if the query result is marked as being partial, and the returned data is reset to an empty Object by the Apollo Client `QueryManager` (due to a cache miss).

The default value is `false` for backwards-compatibility's sake, but should be changed to true for most use-cases.

**Example:**

```js
export default graphql(gql`query MyQuery { ... }`, {
  options: { partialRefetch: true },
})(MyComponent);
```

## `graphql() options for mutations`

### `props.mutate`

The higher order component created when you pass a mutation to `graphql()` will provide your component with a single prop named `mutate`. Unlike the `data` prop which you get when you pass a query to `graphql()`, `mutate` is a function.

The `mutate` function will actually execute your mutation using the network interface therefore mutating your data. The `mutate` function will also then update your cache in ways you define.

To learn more about how mutations work, be sure to check out the [mutations usage documentation](../../data/mutations/).

The `mutate` function accepts the same options that [`config.options`](#configoptions-2) for mutations accepts, so make sure to read through the documentation for that to know what you can pass into the `mutate` function.

The reason the `mutate` function accepts the same options is that it will use the options from [`config.options`](#configoptions-2) _by default_. When you pass an object into the `mutate` function you are just overriding what is already in [`config.options`](#configoptions-2).

**Example:**

```js
function MyComponent({ mutate }) {
  return (
    <button
      onClick={() => {
        mutate({
          variables: { foo: 42 },
        });
      }}
    >
      Mutate
    </button>
  );
}

export default graphql(gql`mutation MyMutation { ... }`)(MyComponent);
```

### `config.options`

An object or function that returns an object of options that are used to configure how the query is fetched and updated.

If `config.options` is a function then it will take the component’s props as its first argument.

The options available for use in this object depend on the operation type you pass in as the first argument to `graphql()`. The references below will document which options are available when your operation is a mutation. To see what other options are available for different operations, see the generic documentation for [`config.options`](#configoptions).

The properties accepted in this options object may also be accepted by the [`props.mutate`](#propsmutate) function. Any options passed into the `mutate` function will take precedence over the options defined in the `config` object.

**Example:**

```js
export default graphql(gql`mutation MyMutation { ... }`, {
  options: {
    // Options go here.
  },
})(MyComponent);
```

```js
export default graphql(gql`mutation MyMutation { ... }`, {
  options: props => ({
    // Options are computed from `props` here.
  }),
})(MyComponent);
```

```js
function MyComponent({ mutate }) {
  return (
    <button
      onClick={() => {
        mutate({
          // Options are component from `props` and component state here.
        });
      }}
    >
      Mutate
    </button>
  );
}

export default graphql(gql`mutation MyMutation { ... }`)(MyComponent);
```

### `options.variables`

The variables which will be used to execute the mutation operation. These variables should correspond to the variables that your mutation definition accepts. If you define `config.options` as a function, or you pass variables into the [`props.mutate`](#propsmutate) function then you may compute your variables from props and component state.

**Example:**

```js
export default graphql(
  gql`
  mutation MyMutation ($foo: String!, $bar: String!) {
    ...
  }
`,
  {
    options: props => ({
      variables: {
        foo: props.foo,
        bar: props.bar,
      },
    }),
  },
)(MyComponent);
```

### `options.optimisticResponse`

Often when you mutate data it is fairly easy to predict what the response of the mutation will be before asking your server. The optimistic response option allows you to make your mutations feel faster by simulating the result of your mutation in your UI before the mutation actually finishes.

To learn more about the benefits of optimistic data and how to use it be sure to read the recipe on [Optimistic UI](../../performance/optimistic-ui/).

This optimistic response will be used with [`options.update`](#optionsupdate) and [`options.updateQueries`](#optionsupdatequeries) to apply an update to your cache which will be rolled back before applying the update from the actual response.

**Example:**

```js
function MyComponent({ newText, mutate }) {
  return (
    <button
      onClick={() => {
        mutate({
          variables: {
            text: newText,
          },
          // The optimistic response has all of the fields that are included in
          // the GraphQL mutation document below.
          optimisticResponse: {
            createTodo: {
              id: -1, // A temporary id. The server decides the real id.
              text: newText,
              completed: false,
            },
          },
        });
      }}
    >
      Add Todo
    </button>
  );
}

export default graphql(gql`
  mutation CreateTodo ($text: String!) {
    createTodo(text: $text) {
      id
      text
      completed
    }
  }
`)(MyComponent);
```

### `options.update`

This option allows you to update your store based on your mutation’s result. By default Apollo Client will update all of the overlapping nodes in your store. Anything that shares the same id as returned by the `dataIdFromObject` you defined will be updated with the new fields from your mutation results. However, sometimes this alone is not sufficient. Sometimes you may want to update your cache in a way that is dependent on the data currently in your cache. For these updates you may use an `options.update` function.

`options.update` takes two arguments. The first is an instance of a `DataProxy` object which has some methods which will allow you to interact with the data in your store. The second is the response from your mutation - either the optimistic response, or the actual response returned by your server (see the mutation result described in the [mutation render prop](./components/#render-prop-function-1) section for more details).

In order to change the data in your store call methods on your `DataProxy` instance like [`writeQuery` and `writeFragment`](../../caching/cache-interaction/#writequery-and-writefragment). This will update your cache and reactively re-render any of your GraphQL components which are querying affected data.

To read the data from the store that you are changing, make sure to use methods on your `DataProxy` like [`readQuery`](../../caching/cache-interaction/#readquery) and [`readFragment`](../../caching/cache-interaction/#readfragment).

For more information on updating your cache after a mutation with the `options.update` function make sure to read the [Apollo Client technical documentation on the subject](../../data/mutations/#making-all-other-cache-updates).

**Example:**

```js
const query = gql`query GetAllTodos { todos { ... } }`;

export default graphql(
  gql`
  mutation CreateTodo ($text: String!) {
    createTodo(text: $text) { ... }
  }
`,
  {
    options: {
      update: (proxy, { data: { createTodo } }) => {
        const data = proxy.readQuery({ query });
        data.todos.push(createTodo);
        proxy.writeQuery({ query, data });
      },
    },
  },
)(MyComponent);
```

### `options.refetchQueries`

Sometimes when you make a mutation you also want to update the data in your queries so that your users may see an up-to-date user interface. There are more fine-grained ways to update the data in your cache which include [`options.updateQueries`](#optionsupdatequeries), and [`options.update`](#optionsupdate). However, you can update the data in your cache more reliably at the cost of efficiency by using `options.refetchQueries`.

`options.refetchQueries` will execute one or more queries using your network interface and will then normalize the results of those queries into your cache. Allowing you to potentially refetch queries you had fetched before, or fetch brand new queries.

`options.refetchQueries` is either an array of strings or objects, or a function which takes the result of the mutation and returns an array of strings or objects.

If `options.refetchQueries` is an array of strings then Apollo Client will look for any queries with the same names as the provided strings and will refetch those queries with their current variables. So for example if you have a GraphQL query component with a query named `Comments` (the query may look like: `query Comments { ... }`), and you pass an array of strings containing `Comments` to `options.refetchQueries` then the `Comments` query will be re-executed and when it resolves the latest data will be reflected in your UI.

If `options.refetchQueries` is an array of objects then the objects must have two properties:

- `query`: Query is a required property that accepts a GraphQL query created with the `gql` template string tag. It should contain a single GraphQL query operation that will be executed once the mutation has completed.
- `[variables]`: Is an optional object of variables that is required when `query` accepts some variables.

If an array of objects with this shape is specified then Apollo Client will refetch these queries with their variables.

**Example:**

```js
export default graphql(gql`mutation MyMutation { ... }`, {
  options: {
    refetchQueries: ['CommentList', 'PostList'],
  },
})(MyComponent);
```

```js
import { COMMENT_LIST_QUERY } from '../components/CommentList';

export default graphql(gql`mutation MyMutation { ... }`, {
  options: props => ({
    refetchQueries: [
      {
        query: COMMENT_LIST_QUERY,
      },
      {
        query: gql`
          query GetPostById ($id: ID!) {
            post(id: $id) {
              commentCount
            }
          }
        `,
        variables: {
          id: props.postID,
        },
      },
    ],
  }),
})(MyComponent);
```

```js
export default graphql(gql`mutation MyMutation { ... }`, {
  options: {
    refetchQueries: mutationResult => ['CommentList', 'PostList'],
  },
})(MyComponent);
```

Please note that refetched queries are handled asynchronously, and by default are not necessarily completed before the mutation has completed. If you want to make sure refetched queries are completed before the mutation is considered done (or resolved), set [`options.awaitRefetchQueries`](#optionsawaitrefetchqueries) to `true`.

### `options.awaitRefetchQueries`

Queries refetched using [`options.refetchQueries`](#optionsrefetchqueries) are handled asynchronously, which means by default they are not necessarily completed before the mutation has completed. Setting `options.awaitRefetchQueries` to `true` will make sure refetched queries are completed before the mutation is considered done (or resolved). `options.awaitRefetchQueries` is `false` by default.

### `options.updateQueries`

**Note: We recommend using [`options.update`](#optionsupdate) instead of `updateQueries`. `updateQueries` will be removed in the next version of Apollo Client**

This option allows you to update your store based on your mutation’s result. By default Apollo Client will update all of the overlapping nodes in your store. Anything that shares the same id as returned by the `dataIdFromObject` you defined will be updated with the new fields from your mutation results. However, sometimes this alone is not sufficient. Sometimes you may want to update your cache in a way that is dependent on the data currently in your cache. For these updates you may use an `options.updateQueries` function.

`options.updateQueries` takes an object where query names are the keys and reducer functions are the values. If you are familiar with Redux, defining your `options.updateQueries` reducers is very similar to defining your Redux reducers. The object looks something like this:

```js
{
  Comments: (previousData, { mutationResult, queryVariables }) => nextData,
}
```

Make sure that the key of your `options.updateQueries` object corresponds to an actual query that you have made somewhere else in your app. The query name will be the name you put after specifying the `query` operation type. So for example in the following query:

```graphql
query Comments {
  entry(id: 5) {
    comments {
      ...
    }
  }
}
```

The query name would be `Comments`. If you have not executed a GraphQL query with the name of `Comments` before somewhere in your application, then the reducer function will never be run by Apollo and the key/value pair in `options.updateQueries` will be ignored.

The first argument to the function you provide as the value for your object will be the previous data for your query. So if your key is `Comments` then the first argument will be the last data object that was returned for your `Comments` query, or the current object that is being rendered by any component using the `Comments` query.

The second argument to your function value will be an object with three properties:

- `mutationResult`: The `mutationResult` property will represent the result of your mutation after hitting the server. If you provided an [`options.optimisticResponse`](#optionsoptimisticresponse) then `mutationResult` may be that object.
- `queryVariables`: The last set of variables that the query was executed with. This is helpful because when you specify the query name it will only update the data in the store for your current variable set.
- `queryName`: This is the name of the query you are updating. It is the same name as the key you provided to `options.updateQueries`.

The return value of your `options.updateQueries` functions _must_ have the same shape as your first `previousData` argument. However, you _must not_ mutate the `previousData` object. Instead you must create a new object with your changes. Just like in a Redux reducer.

**Example:**

```js
export default graphql(
  gql`
  mutation SubmitComment ($text: String!) {
    submitComment(text: $text) { ... }
  }
`,
  {
    options: {
      updateQueries: {
        Comments: (previousData, { mutationResult }) => {
          const newComment = mutationResult.data.submitComment;
          // Note how we return a new copy of `previousData` instead of mutating
          // it. This is just like a Redux reducer!
          return {
            ...previousData,
            entry: {
              ...previousData.entry,
              comments: [newComment, ...previousData.entry.comments],
            },
          };
        },
      },
    },
  },
)(MyComponent);
```

## `withApollo(component)`

```js
import { withApollo } from '@apollo/react-hoc';
```

A simple enhancer which provides direct access to your [`ApolloClient`](../core/ApolloClient/) instance. This is useful if you want to do custom logic with Apollo. Such as calling one-off queries. By calling this function with the component you want to enhance, `withApollo()` will create a new component which passes in an instance of `ApolloClient` as a `client` prop.

If you are wondering when to use `withApollo()` and when to use [`graphql()`](#graphqlquery-configcomponent) the answer is that most of the time you will want to use `graphql()`. `graphql()` provides many of the advanced features you need to work with your GraphQL data. You should only use `withApollo()` if you want the GraphQL client without any of the other features.

This will only be able to provide access to your client if there is an [`<ApolloProvider/>`](./hooks/#the-apolloprovider-component) component higher up in your tree to actually provide the client.

**Example:**

```js
function MyComponent({ client }) {
  console.log(client);
}

export default withApollo(MyComponent);
```