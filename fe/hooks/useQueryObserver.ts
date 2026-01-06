// "use client"

// import { useEffect } from "react"
// import { useQueryClient } from "@tanstack/react-query"

// /**
//  * Hook to observe all query cache changes, invalidations, and updates
//  * Useful for debugging and monitoring React Query behavior
//  * @param enabled - Whether the observer is enabled (default: true)
//  */
export function useQueryObserver(enabled: boolean = true) {
//   const queryClient = useQueryClient()

//   useEffect(() => {
//     if (!enabled) {
//       return
//     }

//     const queryCache = queryClient.getQueryCache()
//     const mutationCache = queryClient.getMutationCache()

//     // Subscribe to query cache changes
//     const unsubscribeQueries = queryCache.subscribe((event) => {
//       console.group(`🔍 Query Cache Event: ${event.type}`)
//       console.log("Query Key:", event.query.queryKey)
//       console.log("Query State:", {
//         status: event.query.state.status,
//         dataUpdatedAt: new Date(event.query.state.dataUpdatedAt).toLocaleTimeString(),
//         errorUpdatedAt: event.query.state.errorUpdatedAt
//           ? new Date(event.query.state.errorUpdatedAt).toLocaleTimeString()
//           : null,
//         fetchStatus: event.query.state.fetchStatus,
//         isStale: event.query.isStale(),
//         data: event.query.state.data,
//       })
      
//       if (event.type === "updated") {
//         console.log("Previous Data:", event.query.state.data)
//       }
      
//       if (event.type === "removed") {
//         console.log("Query removed from cache")
//       }
      
//       console.groupEnd()
//     })

//     // Subscribe to mutation cache changes
//     const unsubscribeMutations = mutationCache.subscribe((event) => {
//       console.group(`🔄 Mutation Cache Event: ${event.type}`)
//       if (event.mutation) {
//         console.log("Mutation:", event.mutation)
//         if (event.mutation.state.data) {
//           console.log("Mutation Data:", event.mutation.state.data)
//         }
//         if (event.mutation.state.error) {
//           console.log("Mutation Error:", event.mutation.state.error)
//         }
//       }
//       console.groupEnd()
//     })

//     // Log all current queries
//     console.log("📊 Current Queries in Cache:")
//     queryCache.getAll().forEach((query) => {
//       console.log({
//         key: query.queryKey,
//         status: query.state.status,
//         dataUpdatedAt: new Date(query.state.dataUpdatedAt).toLocaleTimeString(),
//         isStale: query.isStale(),
//       })
//     })

//     return () => {
//       unsubscribeQueries()
//       unsubscribeMutations()
//     }
//   }, [queryClient, enabled])
// }

// /**
//  * Hook to observe specific query key changes
//  * @param queryKey - The query key to observe
//  * @param enabled - Whether the observer is enabled (default: true)
//  */
// export function useQueryKeyObserver(queryKey: unknown[], enabled: boolean = true) {
//   const queryClient = useQueryClient()

//   useEffect(() => {
//     if (!enabled) {
//       return
//     }

//     const queryCache = queryClient.getQueryCache()
    
//     const query = queryCache.find({ queryKey })
    
//     if (!query) {
//       console.warn(`Query not found for key:`, queryKey)
//       return
//     }

//     const unsubscribe = queryCache.subscribe((event) => {
//       if (JSON.stringify(event.query.queryKey) === JSON.stringify(queryKey)) {
//         console.group(`🎯 Query Key Observer: ${JSON.stringify(queryKey)}`)
//         console.log("Event Type:", event.type)
//         console.log("Query State:", {
//           status: event.query.state.status,
//           fetchStatus: event.query.state.fetchStatus,
//           dataUpdatedAt: new Date(event.query.state.dataUpdatedAt).toLocaleTimeString(),
//           isStale: event.query.isStale(),
//           data: event.query.state.data,
//         })
//         console.groupEnd()
//       }
//     })

//     return unsubscribe
//   }, [queryClient, JSON.stringify(queryKey), enabled])
}

