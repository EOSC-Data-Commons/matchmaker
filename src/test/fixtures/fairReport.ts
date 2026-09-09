// Captured verbatim from the fair-assessment-proxy for DOI 10.1594/PANGAEA.908011.
// Used to prove the client derives score bases the same way the service derives scores.
import type {FairReport} from "@/types/fairTypes";

export const pangaeaReport: FairReport = {
    "id": "fixture",
    "pid": "10.1594/PANGAEA.908011",
    "status": "completed",
    "cells": [
        {
            "cell": "f1",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "pass",
                "fuji": "pass"
            }
        },
        {
            "cell": "f2",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "indeterminate",
                "fuji": "pass"
            }
        },
        {
            "cell": "f3",
            "consensus": "fail",
            "by_assessor": {
                "fair_champion": "fail",
                "fuji": "pass"
            }
        },
        {
            "cell": "f4",
            "consensus": "fail",
            "by_assessor": {
                "fair_champion": "fail",
                "fuji": "pass"
            }
        },
        {
            "cell": "a1",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "pass",
                "fuji": "indeterminate"
            }
        },
        {
            "cell": "a1_1",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "pass",
                "fuji": "indeterminate"
            }
        },
        {
            "cell": "a1_2",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "pass",
                "fuji": "indeterminate"
            }
        },
        {
            "cell": "a2",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "pass",
                "fuji": "indeterminate"
            }
        },
        {
            "cell": "i1",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "pass",
                "fuji": "pass"
            }
        },
        {
            "cell": "i2",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "indeterminate",
                "fuji": "pass"
            }
        },
        {
            "cell": "i3",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "pass",
                "fuji": "pass"
            }
        },
        {
            "cell": "r1",
            "consensus": "partial",
            "by_assessor": {
                "fair_champion": "pass",
                "fuji": "partial"
            }
        },
        {
            "cell": "r1_1",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "pass",
                "fuji": "pass"
            }
        },
        {
            "cell": "r1_2",
            "consensus": "partial",
            "by_assessor": {
                "fair_champion": "indeterminate",
                "fuji": "partial"
            }
        },
        {
            "cell": "r1_3",
            "consensus": "pass",
            "by_assessor": {
                "fair_champion": "indeterminate",
                "fuji": "pass"
            }
        }
    ],
    "scores": {
        "fair_champion": {
            "f": 33.3,
            "a": 100.0,
            "i": 100.0,
            "r": 100.0,
            "overall": 83.3
        },
        "fuji": {
            "f": 100.0,
            "a": null,
            "i": 100.0,
            "r": 83.3,
            "overall": 94.4
        }
    },
    "guidance": [
        {
            "assessor": "fair_champion",
            "cell": "r1_1",
            "test": "LicenseStrong",
            "description": "License found in Linked Data metadata",
            "message": "Acceptable. License is found",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "r1_1",
            "test": "LicenseWeak",
            "description": "License found in metadata in any format",
            "message": "Acceptable. License is found",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "i3",
            "test": "QualifiedRefs",
            "description": "The metadata contains qualified references to external sources",
            "message": "Acceptable. There are qualified references",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "i1",
            "test": "MachineSyntax",
            "description": "The metadata follows a structured syntax",
            "message": "Acceptable.  Structured metadata is found",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "i1",
            "test": "MachineSemantic",
            "description": "The metadata follows a machine-readable syntax (Linked Data)",
            "message": "Acceptable.  Linked Data was found",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "f4",
            "test": "DiscoverableInBing",
            "description": "The metadata is indexed by Bing and the GUID was found using the title or keywords as a search against Bing",
            "message": "Unacceptable.  Search on Bing did not find the record",
            "outcome": "fail",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "f3",
            "test": "MetadataIdentifierFound",
            "description": "The metadata contains an unambiguous reference to its own identifier",
            "message": "Unacceptable.  The metadata does not contain its own identifier",
            "outcome": "fail",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "f3",
            "test": "DataIdentifierFound",
            "description": "The metadata contains an unambiguous reference to the identifier of the data it describes",
            "message": "Unacceptable. The metadata does not contain an unambiguous reference to the data identifier",
            "outcome": "indeterminate",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "f1",
            "test": "MetadataIdentifierUniqe",
            "description": "The identifier of the metadata is globally unique",
            "message": "Acceptable.  The metadata identifier is globally unique",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "f1",
            "test": "MetadataIdentifierPersistent",
            "description": "The identifier of the metadata is persistent",
            "message": "Acceptable.  The metadata identifier is considered persistent",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "a2",
            "test": "MetadataPersistence",
            "description": "The metadata has a persistence policy, or uses an identifier system such as DOIs to achieve metadata persistence",
            "message": "Acceptable.  The metadata is persistent",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "a1_2",
            "test": "DataAuthentication",
            "description": "The protocol for retrieving the DATA, based on its discovered identifier, allows for authentication",
            "message": "Acceptable. The protocol for retrieving the DATA allows for authorization",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "a1_2",
            "test": "MetadataAuthentication",
            "description": "The protocol for retrieving the metadata allows for authorization",
            "message": "Acceptable.  The protocol for retrieving the metadata allows for authorization",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "a1_1",
            "test": "DataOpenProtocol",
            "description": "The protocol for retrieving the DATA, based on its identifier, is open and freely useable",
            "message": "Acceptable.  The protocol for retrieving the DATA is open and freely usable",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fair_champion",
            "cell": "a1_1",
            "test": "MetadataOpenProtocol",
            "description": "The protocol for retrieving the metadata is open and freely usable",
            "message": "Acceptable.  The protocol for retrieving the metadata is open and freely usable",
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "f1",
            "test": "FsF-F1-01D",
            "description": "Data is assigned a globally unique identifier.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "f1",
            "test": "FsF-F1-02D",
            "description": "Data is assigned a persistent identifier.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "f2",
            "test": "FsF-F2-01M",
            "description": "Metadata includes descriptive core elements (creator, title, data identifier, publisher, publication date, summary and keywords) to support data findability.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "f3",
            "test": "FsF-F3-01M",
            "description": "Metadata includes the identifier of the data it describes.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "f4",
            "test": "FsF-F4-01M",
            "description": "Metadata is offered in such a way that it can be retrieved programmatically.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "a1",
            "test": "FsF-A1-01M",
            "description": "Metadata contains access level and access conditions of the data.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "a1",
            "test": "FsF-A1-02M",
            "description": "Metadata is accessible through a standardized communication protocol.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "a1",
            "test": "FsF-A1-03D",
            "description": "Data is accessible through a standardized communication protocol.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "i1",
            "test": "FsF-I1-01M",
            "description": "Metadata is represented using a formal knowledge representation language.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "i2",
            "test": "FsF-I2-01M",
            "description": "Metadata uses semantic resources",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "i3",
            "test": "FsF-I3-01M",
            "description": "Metadata includes links between the data and its related entities.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "r1",
            "test": "FsF-R1-01MD",
            "description": "Metadata specifies the content of the data.",
            "message": "Data content matches file type and size or protocol specified in metadata; Data content matches measured variables or observation types specified in metadata; File size and type information are specified in metadata; Data service endpoint and protocol information are specified in metadata; File parsing using TIKA failed -: Unable to start Tika server.; Could not verify measured variables found in data object content, content parsing failed",
            "outcome": "partial",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "r1_1",
            "test": "FsF-R1.1-01M",
            "description": "Metadata includes license information under which data can be reused.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "r1_2",
            "test": "FsF-R1.2-01M",
            "description": "Metadata includes provenance information about data creation or generation.",
            "message": "Metadata contains provenance information using formal provenance ontologies (PROV-O); Formal provenance metadata is unavailable",
            "outcome": "partial",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "r1_3",
            "test": "FsF-R1.3-01M",
            "description": "Metadata follows a standard recommended by the target research community of the data.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        },
        {
            "assessor": "fuji",
            "cell": "r1_3",
            "test": "FsF-R1.3-02D",
            "description": "Data is available in a file format recommended by the target research community.",
            "message": null,
            "outcome": "pass",
            "guidance": []
        }
    ]
} as FairReport;
