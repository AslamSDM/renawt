import { motion } from "framer-motion";
import { useState, useEffect } from "react";

// Teamble AI Logo Component
export function TeambleLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16"
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center`}>
      <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
      </svg>
    </div>
  );
}

// Notification Card
interface NotificationCardProps {
  title: string;
  message: string;
  actionText?: string;
  delay?: number;
  onAction?: () => void;
}

export function NotificationCard({ title, message, actionText, delay = 0, onAction }: NotificationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-2xl max-w-md"
    >
      <div className="flex items-start gap-4">
        <TeambleLogo size="sm" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
          <p className="text-gray-600 mt-1">{message}</p>
          {actionText && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onAction}
              className="mt-4 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-medium text-sm hover:shadow-lg transition-shadow"
            >
              {actionText}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// 1-on-1 Prep Card
export function OneOnOnePrepCard({ delay = 0 }: { delay?: number }) {
  const [progress, setProgress] = useState(32);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(43);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, rotateX: -30, y: 100 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={{ delay, duration: 0.8, ease: "easeOut" }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl max-w-2xl w-full"
      style={{ perspective: "1000px" }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
        <h3 className="font-semibold text-gray-900">Prep for 1 on 1 with Taylor (Account Executive)</h3>
      </div>
      
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-2xl p-4">
          <h4 className="font-medium text-gray-900 mb-3">Taylor&apos;s Objectives</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-gray-700">Secure 10 new strategic accounts</span>
              </div>
              <span className="text-sm text-green-600 font-medium">On Track</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{progress}%</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-green-500 rounded-full"
                  initial={{ width: "32%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">1 on 1 Prep survey</h4>
            <span className="text-sm text-gray-500">07 January 2025</span>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500 mb-1">01. What recent accomplishments are you most proud of?</p>
              <div className="flex items-center gap-2 bg-white rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                <span className="text-sm text-gray-700">Successfully secured a meeting with a key buyer at a Fortune 500</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">02. What are your main priorities for next month?</p>
              <div className="flex items-center gap-2 bg-white rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                <span className="text-sm text-gray-700">Nail the upcoming demo schedule</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
          <div className="flex items-center gap-2 mb-3">
            <TeambleLogo size="sm" />
            <h4 className="font-medium text-gray-900">AI Assistant</h4>
          </div>
          <p className="text-sm text-gray-600 mb-3">Welcome to your 1 on 1 prep. I would like to help you prep, here are some suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {["Summary of Taylor's feedback", "Summary of Taylor's latest 1-on-1", "Suggest conversation starters"].map((item, i) => (
              <span key={i} className="px-3 py-1.5 bg-white rounded-full text-sm text-purple-600 border border-purple-100">
                + {item}
              </span>
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-pink-400 to-purple-400 text-white rounded-full text-sm font-medium"
          >
            Help me craft feedback
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// Feedback Form
export function FeedbackForm({ delay = 0 }: { delay?: number }) {
  const [score, setScore] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setScore(10);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.6 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl max-w-lg w-full"
    >
      <h3 className="font-semibold text-gray-900 mb-4">Please share your feedback</h3>
      
      <div className="bg-gray-50 rounded-2xl p-4 mb-4">
        <p className="text-lg">
          <span className="text-pink-500">Taylor stumbled</span>
          <span className="text-purple-500"> in the </span>
          <span className="text-blue-500">client demo.</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {["Engaging prospects", "Closing deals"].map((tag, i) => (
          <span key={i} className="px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-600">
            + {tag}
          </span>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-full font-medium"
      >
        Help me craft feedback
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 1, duration: 0.5 }}
        className="mt-6 flex items-center justify-between bg-gray-50 rounded-2xl p-4"
      >
        <div className="flex items-center gap-3">
          <TeambleLogo size="sm" />
          <span className="font-medium text-gray-900">Teamble AI feedback score</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.span 
            className="text-2xl font-bold text-red-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 1.2 }}
          >
            {score}
          </motion.span>
          <span className="text-gray-400">/100</span>
          <div className="w-2 h-2 rounded-full bg-red-500" />
        </div>
      </motion.div>
    </motion.div>
  );
}

// Feedback Score Card
export function FeedbackScoreCard({ delay = 0 }: { delay?: number }) {
  const metrics = [
    { name: "Specificity", value: 24, status: "24%" },
    { name: "Tone", value: 0, status: "Very aggressive" },
    { name: "Focus", value: 0, status: "Critique" },
    { name: "Actionability", value: 0, status: "0%" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl max-w-lg w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TeambleLogo size="sm" />
          <span className="font-semibold text-gray-900">Teamble AI feedback score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-red-500">10</span>
          <span className="text-gray-400">/100</span>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Your current feedback fails to address several components of a best in class feedback. Let&apos;s fix it together!
      </p>

      <div className="space-y-3">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.1 * i, duration: 0.4 }}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${metric.value > 0 ? 'bg-orange-400' : 'bg-red-400'}`} />
              <span className="text-gray-700">{metric.name}</span>
            </div>
            <span className="text-gray-500 text-sm">{metric.status}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Dashboard Component
export function Dashboard({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100, rotateX: -20 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay, duration: 0.8 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full"
      style={{ perspective: "1000px" }}
    >
      {/* Sidebar */}
      <div className="flex">
        <div className="w-48 bg-gray-50 p-4 border-r border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 bg-gray-800 rounded" />
            <span className="font-semibold text-sm">Acme Co.</span>
          </div>
          
          <nav className="space-y-1">
            {["Dashboard", "Objectives", "Reviews", "1-on-1s", "Feedback", "Engagement", "Teamble AI", "Learning", "Data Studio", "Admin Settings", "Templates"].map((item) => (
              <div 
                key={item} 
                className={`px-3 py-2 rounded-lg text-sm ${item === "Teamble AI" ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {item}
              </div>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Happy Monday, Michael!</h2>
          <p className="text-sm text-gray-500 mb-6">It&apos;s 70° sunny day outside.</p>

          {/* 360 Review Campaign */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">360 Review Campaign</h3>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
              </div>
              <button className="text-sm text-gray-500">See details</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Completion rate</div>
                <div className="text-2xl font-semibold text-gray-900">24%</div>
                <div className="text-sm text-gray-500 mt-2">Participants</div>
                <div className="text-xl font-semibold text-gray-900">1,567</div>
                <div className="text-sm text-gray-500 mt-2">Duration</div>
                <div className="text-xl font-semibold text-gray-900">3 months</div>
              </div>
              <div className="space-y-3">
                {["Self-Assessment", "Peer Review", "Manager Evaluation"].map((item) => (
                  <div key={item}>
                    <div className="text-sm text-gray-600 mb-1">{item}</div>
                    <div className="flex gap-1">
                      {[
                        { color: "bg-purple-400", width: "30%" },
                        { color: "bg-blue-400", width: "20%" },
                        { color: "bg-orange-400", width: "15%" },
                        { color: "bg-green-400", width: "35%" }
                      ].map((bar, j) => (
                        <div key={j} className={`h-3 ${bar.color} rounded-full`} style={{ width: bar.width }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Teamble AI Insights */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.5, duration: 0.5 }}
            className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100"
          >
            <div className="flex items-center gap-2 mb-3">
              <TeambleLogo size="sm" />
              <span className="font-semibold text-gray-900">Teamble AI Insights</span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Show more</span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-sm text-gray-500">AI feedback score</span>
                <div className="text-xl font-semibold text-red-500">43/100</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Specificity</span>
                <div className="text-xl font-semibold text-yellow-500">56%</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Tone</span>
                <div className="text-xl font-semibold text-green-500">Positive</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Focus</span>
                <div className="text-xl font-semibold text-purple-500">Praise</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Actionability</span>
                <div className="text-xl font-semibold text-red-500">5%</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// Enhanced Feedback Card
export function EnhancedFeedbackCard({ delay = 0 }: { delay?: number }) {
  const [score, setScore] = useState(89);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setScore(92);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl max-w-lg w-full"
    >
      <h3 className="font-semibold text-gray-900 mb-4">Your AI Enhanced Feedback</h3>
      
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 mb-4 border border-purple-100">
        <p className="text-sm text-gray-700 leading-relaxed">
          Taylor, we need to urgently address the issues from the recent client demo session with Acme Co. 
          It was a critical opportunity, and we must ensure our approach is more aligned with client needs 
          to prevent any negative impact on our credibility.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          During the session, I observed that you faced challenges in tailoring the demo to the client&apos;s 
          specific industry needs and use cases. As a result, the client became disengaged, and the key 
          decision-maker present expressed visible doubts.
        </p>
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-900 mb-2">Suggestions:</p>
          <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1">
            <li>Let&apos;s make sure you have at least one dry run session with your BDR prior to any meetings</li>
            <li>Some refresher micro-courses on disco prep - the day of every call</li>
          </ol>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.5, duration: 0.5 }}
          className="mt-4 bg-white rounded-xl p-3 border border-purple-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-200" />
            <div>
              <p className="text-sm font-medium text-gray-900">Teamble Sales Academy: Crafting Powerful demos</p>
              <p className="text-xs text-gray-500">Top tips on crafting powerful sales demos</p>
              <p className="text-xs text-pink-500 mt-1">Video Added</p>
            </div>
            <div className="ml-auto w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.8, duration: 0.5 }}
        className="flex items-center justify-between bg-gray-50 rounded-2xl p-4"
      >
        <div className="flex items-center gap-3">
          <TeambleLogo size="sm" />
          <span className="font-medium text-gray-900">Teamble AI feedback score</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.span 
            className="text-2xl font-bold text-green-500"
            key={score}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {score}
          </motion.span>
          <span className="text-gray-400">/100</span>
          <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>
      </motion.div>
    </motion.div>
  );
}

// Onboarding Survey Visualization
export function OnboardingSurvey({ delay = 0 }: { delay?: number }) {
  const avatars = [
    "https://i.pravatar.cc/150?img=1",
    "https://i.pravatar.cc/150?img=2", 
    "https://i.pravatar.cc/150?img=3",
    "https://i.pravatar.cc/150?img=4",
    "https://i.pravatar.cc/150?img=5",
    "https://i.pravatar.cc/150?img=6",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.6 }}
      className="relative w-96 h-96"
    >
      {/* Center circle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.3, duration: 0.5 }}
          className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
        >
          <span className="text-white font-semibold text-center text-sm">Onboarding<br/>Survey</span>
        </motion.div>
      </div>

      {/* Orbiting avatars */}
      {avatars.map((avatar, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: 1, 
            scale: 1,
            rotate: 360 
          }}
          transition={{ 
            opacity: { delay: delay + 0.1 * i, duration: 0.3 },
            scale: { delay: delay + 0.1 * i, duration: 0.3 },
            rotate: { delay: delay + 0.5, duration: 20, repeat: Infinity, ease: "linear" }
          }}
          className="absolute w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-lg"
          style={{
            top: "50%",
            left: "50%",
            marginTop: "-24px",
            marginLeft: "-24px",
            transformOrigin: "24px 24px",
            transform: `rotate(${i * 60}deg) translateX(140px) rotate(-${i * 60}deg)`
          }}
        >
          <img src={avatar} alt={`User ${i + 1}`} className="w-full h-full object-cover" />
        </motion.div>
      ))}

      {/* Decorative circles */}
      <div className="absolute inset-0 border border-purple-200/30 rounded-full" style={{ transform: "scale(1.3)" }} />
      <div className="absolute inset-0 border border-purple-200/20 rounded-full" style={{ transform: "scale(1.6)" }} />
    </motion.div>
  );
}

// Insights Heatmap
export function InsightsHeatmap({ delay = 0 }: { delay?: number }) {
  const data = [
    { category: "Experience", values: [4.6, 4.7, 3.6, 3.1] },
    { category: "Clarity", values: [4.6, 4.7, 4.1, 3.1] },
    { category: "Resources", values: [4.6, 4.2, 4.5, 4.6] },
    { category: "Operations", values: [3.6, 2.9, 2.1, 1.4] },
  ];

  const getColor = (value: number) => {
    if (value >= 4.5) return "bg-blue-400";
    if (value >= 4.0) return "bg-blue-500";
    if (value >= 3.0) return "bg-purple-400";
    if (value >= 2.0) return "bg-purple-500";
    return "bg-pink-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl max-w-2xl w-full"
    >
      <div className="flex items-center gap-3 mb-6">
        <TeambleLogo size="sm" />
        <h3 className="font-semibold text-gray-900">Onboarding Survey AI insights</h3>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div></div>
        {["1 week", "2 week", "3 week", "4 week"].map((week, i) => (
          <div key={i} className="text-center text-sm text-gray-500">{week}</div>
        ))}
        
        {data.map((row, i) => (
          <>
            <div key={`label-${i}`} className="text-sm text-gray-700 py-2">{row.category}</div>
            {row.values.map((value, j) => (
              <motion.div
                key={`cell-${i}-${j}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay + 0.05 * (i * 4 + j), duration: 0.3 }}
                className={`${getColor(value)} rounded-lg p-2 text-center text-white font-medium`}
              >
                {value}
              </motion.div>
            ))}
          </>
        ))}
      </div>
    </motion.div>
  );
}

// AI Insights Card
export function AIInsightsCard({ delay = 0 }: { delay?: number }) {
  const insights = [
    "Dissatisfaction with RTO policy changes, citing lack of flexibility and impact on work life balance",
    "All of our competitors are way more flexible in RTO",
    "We are coming to the office and still running zoom meetings, what is the point of RTO",
    "The changes in RTO policy is significantly different than how it was presented in the interview process.",
  ];

  return (
    <div className="space-y-4 max-w-2xl w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        className="bg-purple-100/80 backdrop-blur-xl rounded-2xl p-4"
      >
        <div className="flex items-center gap-3">
          <TeambleLogo size="sm" />
          <span className="font-medium text-gray-900">Teamble AI insights</span>
          <span className="text-gray-700 text-sm">{insights[0]}</span>
        </div>
      </motion.div>

      {insights.slice(1).map((insight, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.2 * (i + 1), duration: 0.5 }}
          className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex-shrink-0" />
          <span className="text-gray-700 text-sm">{insight}</span>
        </motion.div>
      ))}
    </div>
  );
}
