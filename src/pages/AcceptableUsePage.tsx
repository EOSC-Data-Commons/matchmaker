import {Link} from "react-router";
import {Footer} from "../components/Footer";

const AcceptableUsePage = () => {
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
                    EOSC Data Commons Services AUP
                </h1>

                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-[#002337] mb-3">
                        Acceptable Use Policy
                    </h2>
                    <div className="text-sm text-[#1A1A1A] font-light leading-relaxed space-y-3">
                        <p>
                            This Acceptable Use Policy and Conditions of Use (&ldquo;AUP&rdquo;) defines the
                            rules and conditions that govern your access to and use (including transmission,
                            processing, and storage of data) of the resources and services
                            (&ldquo;Services&rdquo;) as granted by EOSC Data Commons for the purpose of
                            providing seamless access to high-quality interoperable research outputs and
                            services, enabling European researchers to collaborate more easily, be more
                            productive and achieve higher levels of excellence.
                        </p>
                        <ol className="list-decimal pl-6 space-y-2">
                            <li>
                                You shall only use the Services in a manner consistent with the purposes and
                                limitations described above; you shall show consideration towards other
                                users including by not causing harm to the Services; you have an obligation
                                to collaborate in the resolution of issues arising from your use of the
                                Services.
                            </li>
                            <li>
                                You shall only use the Services for lawful purposes and not breach, attempt
                                to breach, nor circumvent administrative or security controls.
                            </li>
                            <li>
                                You shall respect intellectual property and confidentiality agreements.
                            </li>
                            <li>
                                You shall protect your access credentials (e.g. passwords, private keys or
                                multi-factor tokens); no intentional sharing is permitted.
                            </li>
                            <li>
                                You shall keep your registered information correct and up to date.
                            </li>
                            <li>
                                You shall promptly report known or suspected security breaches, credential
                                compromise, or misuse to the security contact stated below; and report any
                                compromised credentials to the relevant issuing authorities.
                            </li>
                            <li>
                                Reliance on the Services shall only be to the extent specified by any
                                applicable service level agreements listed below. Use without such
                                agreements is at your own risk.
                            </li>
                            <li>
                                Your personal data will be processed in accordance with the privacy
                                statements referenced below.
                            </li>
                            <li>
                                Your use of the Services may be restricted or suspended, for administrative,
                                operational, or security reasons, without prior notice and without
                                compensation.
                            </li>
                            <li>
                                If you violate these rules, you may be liable for the consequences, which
                                may include your account being suspended and a report being made to your
                                home organisation or to law enforcement.
                            </li>
                            <li>
                                You shall comply with all applicable license terms and conditions governing
                                any datasets, software, tools, or other resources used in connection with
                                the Services, and you are solely responsible for ensuring that your use,
                                processing, sharing, or distribution of such resources is permitted under
                                those licenses.
                            </li>
                        </ol>
                        <p>
                            The administrative contact for this AUP is:{' '}
                            <a
                                href="mailto:eosc-data-commons-po@mailman.egi.eu"
                                className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors wrap-break-word"
                            >
                                eosc-data-commons-po@mailman.egi.eu
                            </a>
                        </p>
                        <p>
                            The security contact for this AUP is:{' '}
                            <a
                                href="mailto:eosc-data-commons-security@mailman.egi.eu"
                                className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors wrap-break-word"
                            >
                                eosc-data-commons-security@mailman.egi.eu
                            </a>
                        </p>
                        <p>
                            The privacy statements (e.g. Privacy Notices) are located at:{' '}
                            <Link
                                to="/privacy-policy"
                                className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors"
                            >
                                EOSC Data Commons Privacy Policy
                            </Link>
                        </p>
                        <p>
                            This Acceptable Use Policy is based on {' '}
                            <a
                                href="https://wise-community.org/wise-baseline-aup/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#009FE3] hover:text-[#002337] underline underline-offset-2 transition-colors"
                            >
                                The WISE Baseline Acceptable Use Policy and Conditions of Use
                            </a>, Version 1, 25 Feb 2019, used under CC BY-NC-SA 4.0
                        </p>
                    </div>
                </section>
            </main>
            <Footer/>
        </div>
    );
};

export default AcceptableUsePage;
