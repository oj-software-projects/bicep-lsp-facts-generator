targetScope = 'resourceGroup'

@description('Name of the local virtual network.')
param localVnetName string

@description('Resource ID of the remote virtual network.')
param remoteVirtualNetworkId string

@description('Name of the peering.')
param name string

@description('Whether forwarded traffic is allowed.')
param allowForwardedTraffic bool

@description('Whether gateway transit is allowed.')
param allowGatewayTransit bool

@description('Whether virtual network access is allowed.')
param allowVirtualNetworkAccess bool

@description('Whether remote gateways are verified.')
param doNotVerifyRemoteGateways bool

@description('Whether remote gateways are used.')
param useRemoteGateways bool

resource vnetPeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2022-07-01' = {
  name: '${localVnetName}/${name}'
  properties: {
    allowForwardedTraffic: allowForwardedTraffic
    allowGatewayTransit: allowGatewayTransit
    allowVirtualNetworkAccess: allowVirtualNetworkAccess
    doNotVerifyRemoteGateways: doNotVerifyRemoteGateways
    useRemoteGateways: useRemoteGateways
    remoteVirtualNetwork: {
      id: remoteVirtualNetworkId
    }
  }
}
