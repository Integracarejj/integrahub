# IntegraIQ Platform Map

## Positioning

IntegraIQ is the platform. It combines shared platform services, business workflow modules, and cross-module intelligence.

```text
                           INTEGRAIQ
                               |
          -------------------------------------------
          |                    |                    |
     PLATFORM SERVICES    BUSINESS MODULES      INTELLIGENCE
          |                    |                    |
     Document Hub             Recap             What We Know
     Identity/Auth        Acquisitions          AI/Search
     Business Topics      Future modules        Shared knowledge
     Systems
     Processes
     Audit/Lifecycle
```

## Current architecture

Shared platform capabilities currently include identity and authorization, the Document Hub / Artifact platform, Business Topics, Systems, Processes, and audit/lifecycle foundations.

Document Hub is **the shared IntegraIQ document/artifact platform**. It is not a standalone Recap document page. It owns trusted provision, business metadata, discovery, authoritative placement-aware download, and document lifecycle behavior.

Recapitalization / Recap is an active business workflow module and is still in progress. Acquisitions is a future business module with little implementation currently established. “What We Know” and broader cross-module intelligence are future capabilities.

The current repository contains some Recap-specific document and SharePoint workflow code. That does not mean every Recap document path already consumes the shared Artifact platform, and no current Acquisitions integration is claimed here.

## Target integration model

- A Recap user works with Documents in the Recap workflow while shared document concerns ultimately rely on the Artifact platform.
- An Acquisitions user should eventually work with Documents inside the Acquisitions workflow without creating a separate identity, storage, or lifecycle system.
- A general IntegraIQ user may use Document Hub directly to provide and find trusted documents.
- Cross-module intelligence should reference shared documents and governed context rather than fork document records into module-owned silos.

Business modules may own workflow-specific context and permissions. The shared platform should own reusable Artifact identity, placement, metadata vocabulary, storage integration, and lifecycle/audit primitives. Moving existing module paths toward this target requires explicit design and must not be inferred as already complete.
