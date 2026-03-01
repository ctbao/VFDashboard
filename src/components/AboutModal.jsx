import { useTranslation } from "react-i18next";

export default function AboutModal({ isOpen, onClose }) {
  const { t } = useTranslation("about");
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10"
        >
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-gray-900 mb-1">
              {t("title")}
            </h2>
            <p className="text-sm font-bold text-gray-500 tracking-wider uppercase">
              {t("openSourceBy")}{" "}
              <span className="text-blue-600">{t("club")}</span>
            </p>
          </div>

          {/* Mobile Content (Short, No Images) */}
          <div className="md:hidden space-y-4">
            <p className="text-gray-700 text-sm leading-relaxed">
              {t("mobileDescription")}
            </p>

            <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">{t("mainGoals")}</h3>
              <ul className="text-sm text-gray-600 space-y-1 list-disc pl-4">
                <li>{t("goals.visualizeHidden")}</li>
                <li>{t("goals.clearMonitoring")}</li>
                <li>{t("goals.communityDriven")}</li>
              </ul>
            </div>

            <div className="text-xs text-gray-400 text-center pt-4 border-t border-gray-100 italic">
              <div className="flex justify-center items-center gap-2 mb-2">
                <span>v1.0.0</span>
                <span>•</span>
                <a
                  href="https://github.com/VF9-Club/VFDashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  GitHub
                </a>
              </div>
              &quot;{t("tagline")}&quot; <br />
              {t("notAffiliated")}
            </div>
          </div>

          {/* Desktop Content (Full, With Images) */}
          <div className="hidden md:block">
            <div className="grid grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <div className="prose prose-blue prose-sm">
                  <p className="text-gray-600 leading-snug">
                    <strong>{t("title")}</strong> is an open-source project
                    initiated by members of <strong>{t("club")}</strong>.
                  </p>
                  <p className="text-gray-600 leading-snug">
                    {t("desktopIntro2")}&mdash;such as
                    <span className="text-blue-600 font-medium">
                      {" "}
                      {t("batterySOH")}
                    </span>{" "}
                    {t("and")}{" "}
                    <span className="text-blue-600 font-medium">
                      {t("ecuVersions")}
                    </span>
                    {t("desktopIntro3")}
                  </p>
                  <p className="text-gray-600 leading-snug">
                    {t("desktopIntro4")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <h4 className="font-bold text-blue-800 mb-1 text-sm">
                      {t("features.deeperInsights")}
                    </h4>
                    <p className="text-xs text-blue-600">
                      {t("features.deeperInsightsDesc")}
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                    <h4 className="font-bold text-green-800 mb-1 text-sm">
                      {t("features.realTimeData")}
                    </h4>
                    <p className="text-xs text-green-600">
                      {t("features.realTimeDataDesc")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-3">
                <div className="rounded-xl overflow-hidden shadow-md border border-gray-100 relative group max-w-[220px]">
                  <img
                    src="/mobile-vf9-energy.webp"
                    alt="Dashboard Preview"
                    className="w-full h-auto transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                    <span className="text-white font-bold text-xs">
                      {t("visualizingHiddenData")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
              <div className="flex justify-center gap-4 text-xs text-gray-400 mb-2">
                <span>{t("versionStable")}</span>
                <span>•</span>
                <a
                  href="https://github.com/VF9-Club/VFDashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 flex items-center gap-1 font-medium transition-colors"
                >
                  {t("viewSourceGitHub")}
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
              <p className="text-sm text-gray-500 font-medium">
                {t("madeWithLove")}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-xl mx-auto leading-normal">
                {t("disclaimer")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
