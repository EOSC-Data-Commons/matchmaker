import {Link} from "react-router";
import {Footer} from "../components/Footer";
import React from "react";

interface PolicySectionProps {
    title: string;
    children: React.ReactNode;
}

const PolicySection = ({title, children}: PolicySectionProps) => (
    <section className="mb-8">
        <h2 className="text-lg font-semibold text-[#002337] mb-3">{title}</h2>
        <div className="text-sm text-[#1A1A1A] font-light leading-relaxed space-y-3">
            {children}
        </div>
    </section>
);

const PrivacyPolicyPage = () => {
    return (
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-12">
                <Link
                    to="/"
                    className="text-sm text-[#009FE3] hover:text-[#002337] transition-colors"
                >
                    &larr; Back to Home
                </Link>

                <h1 className="text-3xl font-bold text-[#002337] mt-6 mb-10">
                    EOSC Data Commons Privacy Policy
                </h1>

                <PolicySection title="Name of the Service">
                    <p>EOSC Matchmaker and EOSC Data Player</p>
                </PolicySection>

                <PolicySection title="Description of the Service">
                    <p>
                        The EOSC Matchmaker and EOSC Data Players and (hereinafter referred to as:
                        &ldquo;the services&rdquo;) provide seamless access to high-quality interoperable
                        research outputs and services, enabling researchers to collaborate more easily, be
                        more productive and achieve higher levels of excellence. This privacy notice
                        describes how we, the EGI Foundation (hereinafter referred to as &ldquo;we&rdquo; or
                        &ldquo;the Data Controller&rdquo;), collect and process data by which project
                        members can be personally identified (&ldquo;Personal Data&rdquo;) when the service
                        is used.
                    </p>
                </PolicySection>

                <PolicySection title="Data controller">
                    <p>
                        The EGI Foundation<br/>
                        Science Park 140<br/>
                        1098 XG Amsterdam<br/>
                        The Netherlands
                    </p>
                </PolicySection>

                <PolicySection title="Data protection officer">
                    <p>
                        The EGI Foundation Data Protection Officer<br/>
                        Science Park 140<br/>
                        1098 XG Amsterdam<br/>
                        The Netherlands<br/>
                        E-mail:{' '}
                        <a
                            href="mailto:dpo@egi.eu"
                            className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors"
                        >
                            dpo@egi.eu
                        </a>
                    </p>
                </PolicySection>

                <PolicySection title="Jurisdiction and supervisory authority">
                    <p>Jurisdiction: NL, The Netherlands</p>
                    <p>
                        EGI Foundation&rsquo;s lead supervisory authority is the Dutch Data Protection
                        Authority. They can be contacted at{' '}
                        <a
                            href="https://autoriteitpersoonsgegevens.nl/en/contact-dutch-dpa/contact-us"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors wrap-break-word"
                        >
                            https://autoriteitpersoonsgegevens.nl/en/contact-dutch-dpa/contact-us
                        </a>.
                    </p>
                </PolicySection>

                <PolicySection title="Personal data processed">
                    <p>The service may process the following personal data:</p>
                    <p className="font-normal">Identification data:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>
                            Identification numbers (a unique, opaque, persistent and non-reassignable
                            Identifier provided by EGI Check-in service)
                        </li>
                        <li>Name</li>
                        <li>E-mail address</li>
                        <li>Other: affiliation, IP address, tokens/access keys for user VREs.</li>
                    </ul>
                    <p className="font-normal">Behavioural data:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Usage data</li>
                        <li>
                            Other: technical logs with timestamps, conversations and messages (chat history,
                            messages stored as JSONB).
                        </li>
                    </ul>
                    <p className="font-normal">Data allowing conclusions on the personality:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Other: membership information on group, roles, and communities.</li>
                    </ul>
                </PolicySection>

                <PolicySection title="Purpose of the processing of personal data">
                    <p>
                        The purpose of the collection, processing and use of the personal data mentioned
                        above is:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>
                            To provide the service functions, i.e. to let users perform searches through
                            chat interface, access datasets and execute analysis tools on the available
                            VREs.
                        </li>
                        <li>
                            Identify the users or the administrators accessing the service and track usage
                            of resources for accounting, security management and maintaining service
                            stability and performance.
                        </li>
                    </ul>
                </PolicySection>

                <PolicySection title="Legal basis">
                    <p>
                        The legal basis for processing personal data is: compliance with a legal obligation
                        or legitimate interests pursued by the controller or by a third party according to
                        Art. 6 (1) (f) General Data Protection Regulation (GDPR).
                    </p>
                </PolicySection>

                <PolicySection title="Third parties to whom personal data is disclosed">
                    <p>
                        Personal data will not be used beyond the original purpose of their acquisition. If
                        a forwarding to third parties should be necessary to answer an inquiry or to carry
                        out a service, the consent of the data subject is considered to have been given when
                        using the respective function or service. In particular, the data you provide to us
                        will not be used for marketing.
                    </p>
                    <p>
                        For the purpose given in this privacy policy, personal data may be passed to the
                        following third parties:
                    </p>
                    <p className="font-normal">Within the EU / EEA:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>CYFRONET (resource provider, service administrator)</li>
                        <li>CESNET (resource provider, service administrator)</li>
                    </ul>
                    <p>
                        The records of your use and technical log files produced by the Service components
                        may be shared, via secured mechanisms, for security incident response purposes with
                        other authorised participants in the academic and research distributed digital
                        infrastructures authorised by EGI Foundation governance, only for the same purposes
                        and only as far as necessary to provide the incident response capability where doing
                        so is likely to assist in the investigation of suspected misuse of Infrastructure
                        resources.
                    </p>
                    <p>
                        Any data transfer to a third country outside the EU or the EEA only takes place
                        under the conditions contained in Chapter V of the GDPR and in compliance with the
                        provisions of this privacy policy and any related policies adopted by the EGI
                        Federation.
                    </p>
                </PolicySection>

                <PolicySection title="Your rights">
                    <p>
                        You can exercise the following rights at any time by contacting our Data Protection
                        Officer using the contact details provided in the Data Protection Officer section:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Information about the data stored with us and their processing;</li>
                        <li>Correction of incorrect personal data;</li>
                        <li>Deletion of the data stored by us;</li>
                        <li>
                            Restriction of data processing, if we are not yet allowed to delete the data due
                            to legal obligations;
                        </li>
                        <li>Objection to the processing of the data by us;</li>
                        <li>Data portability.</li>
                    </ul>
                    <p>
                        Project members can complain at any time to the supervisory data protection
                        authority (DPA). The responsible DPA depends on the country and state of residence,
                        of the project member&rsquo;s workplace, or of the presumed violation. A list of the
                        supervisory authorities with addresses can be found at{' '}
                        <a
                            href="https://edpb.europa.eu/about-edpb/board/members_en"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors wrap-break-word"
                        >
                            https://edpb.europa.eu/about-edpb/board/members_en
                        </a>.
                    </p>
                    <p>
                        You can contact EGI Foundation&rsquo;s lead supervising authority using the contact
                        details provided in the Jurisdiction and Supervisory Authority section.
                    </p>
                </PolicySection>

                <PolicySection title="Data retention and deletion">
                    <p>
                        The records of your use and technical log files produced by the service components
                        will be deleted or anonymised after, at most, 18 months.
                    </p>
                </PolicySection>

                <PolicySection title="Security">
                    <p>
                        We take appropriate technical and organisational measures to ensure data security
                        and the protection against accidental or unlawful destruction, accidental loss,
                        alteration, unauthorised disclosure, or access.
                    </p>
                    <p>
                        A comprehensive overview of the technical and organisational measures taken by EGI
                        Foundation can be found at{' '}
                        <a
                            href="https://documents.egi.eu/public/ShowDocument?docid=3737"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors"
                        >
                            EGI Document 3737: EGI Foundation Technical and Organisational Measures (TOM)
                        </a>.
                    </p>
                </PolicySection>

                <PolicySection title="Data Protection Code of Conduct">
                    <p>
                        EGI Foundation is conforming to GEANT Code of Conduct and project members personal
                        data will be processed in accordance with the{' '}
                        <a
                            href="https://wiki.refeds.org/display/CODE/Code+of+Conduct+for+Service+Providers+1.0"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors"
                        >
                            Code of Conduct for Service Providers
                        </a>{' '}
                        and the{' '}
                        <a
                            href="https://documents.egi.eu/public/ShowDocument?docid=2732"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors"
                        >
                            EGI-doc-2732-v3: Policy on the Processing of Personal Data
                        </a>.
                    </p>
                    <p>
                        This policy is based on{' '}
                        <a
                            href="https://aarc-community.org/policy/policy-development-kit/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors"
                        >
                            AARC Policy development kit
                        </a>{' '}
                        (licensed under{' '}
                        <a
                            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors"
                        >
                            CC BY-NC-SA 4.0
                        </a>).
                    </p>
                </PolicySection>
            </main>
            <Footer/>
        </div>
    );
};

export default PrivacyPolicyPage;
