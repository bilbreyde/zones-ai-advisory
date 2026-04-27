/* ─────────────────────────────────────────────────────────────────────────
   Shared environment constants — single source of truth used by both
   EnvironmentProfile.jsx and AgentStudio.jsx.
   ───────────────────────────────────────────────────────────────────────── */

export const DEPLOYMENT_MODELS = [
  { id: 'cloud_native', label: 'Cloud Native',          desc: 'All workloads run in Azure, AWS, or GCP',            icon: '☁️' },
  { id: 'hybrid',       label: 'Hybrid',                desc: 'Mix of cloud and on-premises infrastructure',         icon: '🔀' },
  { id: 'on_prem',      label: 'Primarily On-Premises', desc: 'Most workloads run in your own data center',          icon: '🏢' },
  { id: 'air_gapped',   label: 'Air-Gapped',            desc: 'Isolated network, no direct internet access',         icon: '🔒' },
]

export const CLOUD_TOOL_CATEGORIES = [
  { id: 'crm',         label: 'CRM',              tools: ['Salesforce','HubSpot','Dynamics 365','Zoho CRM','SAP CRM','Pipedrive'] },
  { id: 'erp',         label: 'ERP',              tools: ['SAP S/4HANA','Oracle ERP Cloud','NetSuite','Dynamics 365 F&O','Sage','Infor CloudSuite'] },
  { id: 'cloud',       label: 'Cloud Platform',   tools: ['Azure','Azure AI Foundry','Azure OpenAI','AWS','AWS Bedrock','GCP','Google Vertex AI','Multi-cloud'] },
  { id: 'data',        label: 'Data & Analytics', tools: ['Databricks','Snowflake','Microsoft Fabric','Power BI','Tableau','Looker','Azure Data Factory','dbt','Azure Synapse','Qlik'] },
  { id: 'itsm',        label: 'ITSM / PM',        tools: ['ServiceNow','Jira','Zendesk','Azure DevOps','Monday.com','Asana','Freshdesk','BMC Helix'] },
  { id: 'collab',      label: 'Collaboration',    tools: ['Microsoft Teams','SharePoint','OneDrive','Microsoft 365','Slack','Zoom','Webex','Google Workspace','Viva Engage'] },
  { id: 'security',    label: 'Security',         tools: ['Microsoft Sentinel','Microsoft Defender','CrowdStrike','Splunk','Palo Alto Prisma','Qualys','Tenable','Okta','Entra ID'] },
  { id: 'hr',          label: 'HR / HCM',         tools: ['Workday','SAP SuccessFactors','ADP','UKG','BambooHR','Ceridian Dayforce','Oracle HCM'] },
  { id: 'finance',     label: 'Finance',          tools: ['SAP Finance','Oracle Financials Cloud','Workiva','Anaplan','Sage Intacct','BlackLine','Concur'] },
  { id: 'supplychain', label: 'Supply Chain',     tools: ['Blue Yonder','Kinaxis','o9 Solutions','SAP IBP','Oracle SCM','E2open','Manhattan Associates'] },
  { id: 'devtools',    label: 'Dev Tools',        tools: ['GitHub','GitLab','Azure DevOps','Docker','Kubernetes','Terraform','Ansible','Jenkins'] },
  { id: 'documents',   label: 'Document Mgmt',    tools: ['SharePoint','DocuSign','Adobe Acrobat Sign','OpenText','Nintex','M-Files','Box'] },
  { id: 'ehr',         label: 'EHR / Clinical',   verticals: ['Healthcare'],        tools: ['Epic','Cerner (Oracle Health)','Meditech','Allscripts','athenahealth','eClinicalWorks','Veeva'] },
  { id: 'retail',      label: 'Retail / POS',     verticals: ['Retail'],            tools: ['Shopify','Magento','SAP Commerce','Oracle Retail','Manhattan WMS','Salesforce Commerce'] },
  { id: 'energy',      label: 'Energy / OT',      verticals: ['Energy'],            tools: ['OSIsoft PI','Honeywell','Siemens MindSphere','GE Predix','SCADA systems','Maximo'] },
]

export const ON_PREM_CATEGORIES = [
  { id: 'compute',      label: 'Compute',        tools: ['Windows Server','Linux Server','VMware vSphere','Hyper-V','Nutanix','OpenStack','Azure Stack HCI','Azure Arc'] },
  { id: 'onprem_data',  label: 'Data',           tools: ['SQL Server (on-prem)','Oracle DB (on-prem)','IBM Db2','Teradata','IBM Netezza','PostgreSQL (on-prem)','MySQL (on-prem)','MongoDB (on-prem)'] },
  { id: 'storage',      label: 'Storage',        tools: ['NAS','SAN','Dell EMC','NetApp','Pure Storage','HPE Nimble','Windows File Server'] },
  { id: 'networking',   label: 'Connectivity',   tools: ['ExpressRoute','Site-to-Site VPN','MPLS','SD-WAN','Cisco','Palo Alto (on-prem)'] },
  { id: 'identity',     label: 'Identity',       tools: ['Active Directory','LDAP','ADFS','Azure AD Connect','Ping Identity','CyberArk'] },
  { id: 'ai_inference', label: 'AI / Inference', tools: ['Azure Arc (AI)','NVIDIA GPU servers','Local LLM (Ollama)','Private model hosting','Edge inference'] },
]

export const LEGACY_CATEGORIES = [
  { id: 'legacy_erp',    label: 'Legacy ERP',     tools: ['SAP R/3','SAP ECC 6.0','Oracle E-Business Suite','JD Edwards','Infor M3','Epicor','BAAN'] },
  { id: 'mainframe',     label: 'Mainframe',      tools: ['IBM Mainframe (z/OS)','IBM AS/400 (iSeries)','COBOL applications','CICS','IMS','Unisys'] },
  { id: 'legacy_custom', label: 'Custom / Other', tools: ['Custom-built apps','Access databases','Excel-driven processes','FTP integrations','EDI systems','VB6 applications'] },
]

export const COMPLIANCE_FRAMEWORKS = [
  { id: 'hipaa',    label: 'HIPAA',       desc: 'Healthcare data',           verticals: ['Healthcare'] },
  { id: 'fedramp',  label: 'FedRAMP',     desc: 'US Federal',                verticals: ['Public Sector'] },
  { id: 'itar',     label: 'ITAR',        desc: 'Defense / Export control',  verticals: ['Public Sector'] },
  { id: 'pci',      label: 'PCI-DSS',     desc: 'Payment card data',         verticals: ['Financial Services','Retail'] },
  { id: 'gdpr',     label: 'GDPR',        desc: 'EU data residency',         verticals: [] },
  { id: 'soc2',     label: 'SOC 2',       desc: 'Service organization',      verticals: [] },
  { id: 'iso27001', label: 'ISO 27001',   desc: 'Information security',      verticals: [] },
  { id: 'nist',     label: 'NIST AI RMF', desc: 'AI risk management',        verticals: [] },
  { id: 'cmmc',     label: 'CMMC',        desc: 'Defense contractors',       verticals: ['Public Sector'] },
  { id: 'sox',      label: 'SOX',         desc: 'Financial reporting',       verticals: ['Financial Services'] },
]

export const CONSTRAINTS = [
  { id: 'data_residency',  label: 'Data Residency Requirements',  desc: 'Data cannot leave a specific geographic region' },
  { id: 'no_cloud_ai',     label: 'No External AI APIs',          desc: 'AI model calls cannot go to third-party cloud services' },
  { id: 'change_control',  label: 'Strict Change Control',        desc: 'All changes require formal approval process' },
  { id: 'vendor_approval', label: 'Vendor Approval Process',      desc: 'New software vendors require IT/security approval' },
]

export const INDUSTRIES = [
  'Financial Services','Healthcare','Manufacturing','Retail',
  'Energy','Professional Services','Public Sector','Technology',
]

// Flat set of all predefined tool names — used to distinguish custom entries
export const ALL_PREDEFINED = new Set([
  ...CLOUD_TOOL_CATEGORIES.flatMap(c => c.tools),
  ...ON_PREM_CATEGORIES.flatMap(c => c.tools),
  ...LEGACY_CATEGORIES.flatMap(c => c.tools),
])
