targetScope = 'resourceGroup'

//Kurzname der Azure-Region
//Gekürzte Position der Kleinbuchstaben, z.B. Deutschlandwestzentral wird dem Regionalcode zugeordnet, z. B. gwc
var trimmedLocation = toLower(replace(location, ' ', ''))
var regionCodes = {
  germanynorth: 'gn'
  germanywestcentral: 'gwc'
  northeurope: 'ne2'
  westeurope: 'we'
}
var regionCode = regionCodes[trimmedLocation]

@description('Erforderlich. Kurzname des Workspace.')
param workspaceShortName string

@description('Erforderlich. Langname des Workspace.')
param workspaceLongName string

@description('Erforderlich. Id des Workspace.')
param workspaceId string
 
@description('Optional. Ort, an dem alle Ressourcen erstellt werden.')
param location string = resourceGroup().location

@description('Erforderlich. Vnet Base Name.')
param vnetBaseName string 

@description('Erforderlich. Voller Vnet Name')
var fullVnetName = 'vnet-${vnetBaseName}-${workspaceShortName}-${regionCode}-${padLeft(1, 3, '0')}'

@description('Erforderlich. Voller Vnet Name')
var fullDummyVnetName = 'vnet-dummy-${workspaceShortName}-${regionCode}-${padLeft(1, 3, '0')}'

@description('Optional. Gibt an ob ein Dummy VNET für IaC Test-Deployments ausgerollt wird. Default ist immer "true"')
param deployDummyVnet bool = true

@description('Erforderlich. Ein Array aus einem oder mehreren IP-Adresspräfixen für das virtuelle Netzwerk.')
param vnetAddressPrefixes array

@description('Optional. Ein Array von Subnetzen zur Bereitstellung im virtuellen Netzwerk.')
param subnets array = []

@description('Optional. Dem virtuellen Netzwerk zugeordnete DNS-Server.')
param dnsServers array = []

@description('Optional. Ressourcen-ID des DDoS-Schutzplans, dem das VNET zugewiesen werden soll. Wenn es leer bleibt, wird der DDoS-Schutz nicht konfiguriert. Wenn es bereitgestellt wird, wird das von dieser Vorlage erstellte VNET an den referenzierten DDoS-Schutzplan angehängt. Der DDoS-Schutzplan kann im selben oder in einem anderen Abonnement vorhanden sein.')
param dDosProtectionPlanId string = ''

@description('Optional. Konfigurationen für virtuelle Netzwerk-Peerings.')
param peerings array = []

@description('Optional. Gibt an, ob die Verschlüsselung im virtuellen Netzwerk aktiviert ist und ob VMs ohne Verschlüsselung im verschlüsselten VNet zulässig sind. Erfordert die Registrierung der Funktion „EnableVNetEncryption“ für das Abonnement und eine unterstützte Region, um diese Eigenschaft verwenden zu können.')
param vnetEncryption bool = false

@allowed([
  'AllowUnencrypted'
  'DropUnencrypted'
])
@description('Optional. Wenn das verschlüsselte VNet eine VM zulässt, die keine Verschlüsselung unterstützt. Kann nur verwendet werden, wenn vnetEncryption aktiviert ist.')
param vnetEncryptionEnforcement string = 'AllowUnencrypted'

@maxValue(30)
@description('Optional. Das Flow-Timeout in Minuten für das virtuelle Netzwerk, das verwendet wird, um die Verbindungsverfolgung für Intra-VM-Flows zu ermöglichen. Mögliche Werte liegen zwischen 4 und 30 Minuten. Der Standardwert 0 setzt die Eigenschaft auf null.')
param flowTimeoutInMinutes int = 0

@description('Optional. Tags für das VNET.')
param tags object = {}

var dnsServersVar = {
  dnsServers: array(dnsServers)
}

var dDosProtectionPlan = {
  id: dDosProtectionPlanId
}

// Dummy VNET Configuration part

var dummyVnetConfig = {
  properties: {
    addressSpace: {
      addressPrefixes: [
        '192.168.0.0/16'
      ]
    }
  }
}

var dummySubnetConfigs =[
  {
    name: 'default'
    addressPrefix: '192.168.0.0/24'
  }
  {
    name: 'SqlManagedInstance'
    addressPrefix: '192.168.1.0/24'
    delegations: [
      {
        name: 'SqlManagedInstance'
        properties: {
          serviceName: 'Microsoft.Sql/managedInstances'
        }
      }
    ]
  }
  {
    name: 'MySqlFlexibleServers'
    addressPrefix: '192.168.2.0/24'
    delegations: [
      {
        name: 'MySqlFlexibleServers'
        properties: {
          serviceName: 'Microsoft.DBforMySQL/flexibleServers'
        }
      }
    ]
  }
  {
    name: 'WebAppServerFarms'
    addressPrefix: '192.168.3.0/24'
    delegations: [
      {
        name: 'WebAppServerFarms'
        properties: {
          serviceName: 'Microsoft.Web/serverFarms'
        }
      }
    ]
  }
]

var dummyVnetSubnetConfig = [for dummySubnetConfig in dummySubnetConfigs: {
    name: dummySubnetConfig.name
    properties: {
      addressPrefix: dummySubnetConfig.addressPrefix
      addressPrefixes: dummySubnetConfig.?addressPrefixes ?? []
      delegations: dummySubnetConfig.?delegations ?? []
    }
}]

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2022-07-01' = {
  name: fullVnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: vnetAddressPrefixes
    }
    ddosProtectionPlan: !empty(dDosProtectionPlanId) ? dDosProtectionPlan : null
    dhcpOptions: !empty(dnsServers) ? dnsServersVar : null
    enableDdosProtection: !empty(dDosProtectionPlanId)
    encryption: vnetEncryption == true ? {
      enabled: vnetEncryption
      enforcement: vnetEncryptionEnforcement
    } : null
    flowTimeoutInMinutes: flowTimeoutInMinutes != 0 ? flowTimeoutInMinutes : null
    subnets: [for subnet in subnets: {
      name: subnet.name
      properties: {
        addressPrefix: subnet.addressPrefix
        addressPrefixes: contains(subnet, 'addressPrefixes') ? subnet.addressPrefixes : []
        applicationGatewayIpConfigurations: contains(subnet, 'applicationGatewayIpConfigurations') ? subnet.applicationGatewayIpConfigurations : []
        delegations: contains(subnet, 'delegations') ? subnet.delegations : []
        ipAllocations: contains(subnet, 'ipAllocations') ? subnet.ipAllocations : []
        natGateway: contains(subnet, 'natGatewayId') ? {
          id: subnet.natGatewayId
        } : null
        networkSecurityGroup: contains(subnet, 'networkSecurityGroupId') ? {
          id: subnet.networkSecurityGroupId
        } : null
        privateEndpointNetworkPolicies: contains(subnet, 'privateEndpointNetworkPolicies') ? subnet.privateEndpointNetworkPolicies : null
        privateLinkServiceNetworkPolicies: contains(subnet, 'privateLinkServiceNetworkPolicies') ? subnet.privateLinkServiceNetworkPolicies : null
        routeTable: contains(subnet, 'routeTableId') ? {
          id: subnet.routeTableId
        } : null
        serviceEndpoints: contains(subnet, 'serviceEndpoints') ? subnet.serviceEndpoints : []
        serviceEndpointPolicies: contains(subnet, 'serviceEndpointPolicies') ? subnet.serviceEndpointPolicies : []
      }
    }]
  }
}

resource dummyVnet 'Microsoft.Network/virtualNetworks@2022-07-01' = if (deployDummyVnet == true) {
  name: fullDummyVnetName
  location: location
  properties: {
    addressSpace: dummyVnetConfig.properties.addressSpace
    subnets: dummyVnetSubnetConfig
  }
}
 
// Local to Remote peering 
module virtualNetwork_peering_local 'vnet_peering.bicep' = [for (peering, index) in peerings: {
  name: '${uniqueString(deployment().name, location)}-virtualNetworkPeering-local-${index}'
  params: {
    localVnetName: virtualNetwork.name
    remoteVirtualNetworkId: peering.remoteVirtualNetworkId
    name: contains(peering, 'name') ? peering.name : '${fullVnetName}-${last(split(peering.remoteVirtualNetworkId, '/'))}'
    allowForwardedTraffic: contains(peering, 'allowForwardedTraffic') ? peering.allowForwardedTraffic : true
    allowGatewayTransit: contains(peering, 'allowGatewayTransit') ? peering.allowGatewayTransit : false
    allowVirtualNetworkAccess: contains(peering, 'allowVirtualNetworkAccess') ? peering.allowVirtualNetworkAccess : true
    doNotVerifyRemoteGateways: contains(peering, 'doNotVerifyRemoteGateways') ? peering.doNotVerifyRemoteGateways : true
    useRemoteGateways: contains(peering, 'useRemoteGateways') ? peering.useRemoteGateways : false
  }
}] 

// Remote to local peering (reverse)
module virtualNetwork_peering_remote 'vnet_peering.bicep' = [for (peering, index) in peerings: if (contains(peering, 'remotePeeringEnabled') ? peering.remotePeeringEnabled == true : false) {
  name: '${uniqueString(deployment().name, location)}-virtualNetworkPeering-remote-${index}'
  scope: resourceGroup(split(peering.remoteVirtualNetworkId, '/')[2], split(peering.remoteVirtualNetworkId, '/')[4])
  params: {
    localVnetName: '${last(split(peering.remoteVirtualNetworkId, '/'))}'
    remoteVirtualNetworkId: virtualNetwork.id
    name: contains(peering, 'remotePeeringName') ? peering.remotePeeringName : '${last(split(peering.remoteVirtualNetworkId, '/'))}-${vnetBaseName}'
    allowForwardedTraffic: contains(peering, 'remotePeeringAllowForwardedTraffic') ? peering.remotePeeringAllowForwardedTraffic : true
    allowGatewayTransit: contains(peering, 'remotePeeringAllowGatewayTransit') ? peering.remotePeeringAllowGatewayTransit : false
    allowVirtualNetworkAccess: contains(peering, 'remotePeeringAllowVirtualNetworkAccess') ? peering.remotePeeringAllowVirtualNetworkAccess : true
    doNotVerifyRemoteGateways: contains(peering, 'remotePeeringDoNotVerifyRemoteGateways') ? peering.remotePeeringDoNotVerifyRemoteGateways : true
    useRemoteGateways: contains(peering, 'remotePeeringUseRemoteGateways') ? peering.remotePeeringUseRemoteGateways : false
  }
}]

@description('Der Name der Ressourcengruppe, in der das VNET bereitgestellt wurde.')
output resourceGroupName string = resourceGroup().name

@description('Die Ressourcen-ID des virtuellen Netzwerks.')
output resourceId string = virtualNetwork.id

@description('Der Name des virtuellen Netzwerks.')
output name string = virtualNetwork.name

@description('Die Namen der bereitgestellten Subnetze.')
output subnetNames array = [for subnet in subnets: subnet.name]

//TODO: Test required:
//Changed: output subnetResourceIds array = [for subnet in Subnets: az.resourceId('Microsoft.Network/virtualNetworks/subnets', name, subnet.name)]
//to
//output subnetResourceIds array = [for subnet in Subnets: az.resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetwork.name, subnet.name)]

@description('Die Ressourcen-IDs der bereitgestellten Subnetze.')
output subnetResourceIds array = [for subnet in subnets: az.resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetwork.name, subnet.name)]

@description('Der Standort, an dem die Ressource bereitgestellt wurde.')
output location string = virtualNetwork.location


//Required for Pipeline
@description('Output Workspace Id.')
output parWorkspaceId string = workspaceId

@description('Output Workspace Langname.')
output parWorkspaceLongName string = workspaceLongName
 
