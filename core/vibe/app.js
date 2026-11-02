const {
  useState,
  useEffect,
  useRef
} = React;

// =========================================================================
// 1. AI 포니봇 확장블록 정의
// =========================================================================
const PONYBOT_EXTENSION = `
declare enum DigitalPin { P0, P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16 }

declare namespace aiPonybot {
    enum Mecanum { LeftForward = 1, Forward = 2, RightForward = 3, Left = 4, Stop = 5, Right = 6, LeftBackward = 7, Backward = 8, RightBackward = 9 }
    enum DirectionControl { Forward = 1, Backward = 2, Clockwise = 3, CounterClockwise = 4 }
    enum Stepper { Stepper42 = 1, Stepper28 = 2 }
    enum Servo { Servo1 = 1, Servo2 = 2, Servo3 = 3, Servo4 = 4, Servo5 = 5, Servo6 = 6, Servo7 = 7, Servo8 = 8 }
    enum Motor { Motor1 = 1, Motor2 = 2, Motor3 = 3, Motor4 = 4 }
    enum Direction { Clockwise = 1, CounterClockwise = -1 }
    enum StepperPair { Motors1And2 = 1, Motors3And4 = 2 }
    
    function servo(index: Servo, degree: number): void;
    function runMotor(index: Motor, direction: Direction, speed: number): void;
    function runMecanum(direction: Mecanum, speed: number): void;
    function stopMotor(index: Motor): void;
    function stopAllMotors(): void;
    function runNormal(direction: DirectionControl, speed: number): void;
    
    enum TwoLineState { OffOff = 0, OnOn = 1, OnOff = 2, OffOn = 3 }
    enum LineState { Off = 0, On = 1 }
    enum LineSensorChannel { Left = 1, Right = 2 }
    function checkTwoLineState(state: TwoLineState): boolean;
    function checkSingleLineSensor(channel: LineSensorChannel, state: LineState): boolean;
    function readLineSensor(channel: LineSensorChannel): number;
    
    enum PingUnit { MicroSeconds, Centimeters, Inches }
    function ping(unit: PingUnit, maxCmDistance?: number): number;
    
    enum SensorVersion { V1 = 1, V2 = 2 }
    enum DetectedColor { Red, Green, Blue, Yellow }
    function initColorSensor(version: SensorVersion): void;
    function getLight(): number;
    function getRed(): number;
    function getGreen(): number;
    function getBlue(): number;
    function isColorAdvanced(color: DetectedColor, threshold?: number): boolean;
    function isColorInRange(minR: number, maxR: number, minG: number, maxG: number, minB: number, maxB: number): boolean;
    
    enum UARTDataType { X, Y, W, H, D }
    enum ColorDataType { R, G, B, I }
    enum ReturnFormat { String, Number }
    function parseUARTUnified(data: string, type: UARTDataType, format: ReturnFormat): any;
    function parseColorUnified(data: string, color: ColorDataType, format: ReturnFormat): any;
    
    enum FaceDataType { X, Y, Z, Yaw, Pitch, Mouth, LeftEye, RightEye, Roll, Smile, Visible }
    enum HandDataType { LeftDir, LeftSpeed, RightDir, RightSpeed }
    function parseFaceUnified(data: string, type: FaceDataType): number;
    function parseHandPoseUnified(data: string, type: HandDataType, format: ReturnFormat): any;
    
    enum Display { On = 1, Off = 0 }
    function invert(on?: boolean): void;
    function clear(): void;
    function display(on: boolean): void;
    function pixel(x: number, y: number, color?: number): void;
    function showString(text: string, column: number, row: number, color?: number): void;
    function showNumber(number: number, column: number, row: number, color?: number): void;
    function printString(text: string, newline?: boolean): void;
    function printNumber(number: number, newline?: boolean): void;
    function horizontalLine(x: number, y: number, length: number, color?: number): void;
    function verticalLine(x: number, y: number, length: number, color?: number): void;
    function rectangle(x1: number, y1: number, x2: number, y2: number, color?: number): void;
}

declare namespace neopixel {
    enum NeoPixelColors { Red = 0xFF0000, Orange = 0xFFA500, Yellow = 0xFFFF00, Green = 0x00FF00, Blue = 0x0000FF, Indigo = 0x000080, Violet = 0x8a2be2, White = 0xFFFFFF, Black = 0x000000 }
    enum NeoPixelMode { RGB = 1, RGBW = 2, RGB_RGB = 3 }
    enum HueInterpolationDirection { Clockwise, CounterClockwise, Shortest }
    class Strip {
        showColor(rgb: number): void;
        showRainbow(startHue?: number, endHue?: number): void;
        showBarGraph(value: number, high: number): void;
        setPixelColor(pixelOffset: number, rgb: number): void;
        show(): void;
        clear(): void;
        getLength(): number;
        setBrightness(brightness: number): void;
        createRange(start: number, length: number): Strip;
        setPin(pin: DigitalPin): void;
    }
    function create(pin: DigitalPin, numLeds: number, mode: NeoPixelMode): Strip;
    function rgb(red: number, green: number, blue: number): number;
    function pickColorPackRGB(color: number): number;
    function getColors(color: NeoPixelColors): number;
    function hsl(hue: number, saturation: number, luminance: number): number;
}
`;

// =========================================================================
// 2. 바이브램프 확장블록 정의
// =========================================================================
const VIBELAMP_EXTENSION = `
declare enum DigitalPin { P0, P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16 }
enum NeoPixelColors {
    Red = 0xFF0000,
    Orange = 0xFFA500,
    Yellow = 0xFFFF00,
    Green = 0x00FF00,
    Blue = 0x0000FF,
    Indigo = 0x000080,
    Violet = 0x8a2be2,
    White = 0xFFFFFF,
    Black = 0x000000
}

enum NeoPixelMode {
    RGB = 1,
    RGBW = 2,
    RGB_RGB = 3
}

namespace vibeLamp {
    function sendBuffer(buf: Buffer, pin: DigitalPin): void;

    export class Strip {
        buffer: Buffer;
        pin: DigitalPin;
        brightness: number;
        start: number;
        _length: number;
        mode: NeoPixelMode;
        matrixWidth: number;
        matrixChain: number;
        matrixRotation: number;
        _isShowing: boolean;

        showColor(rgb: number): void;
        clear(): void;
        setBrightness(brightness: number): void;
        createRange(start: number, length: number): Strip;
        show(): void;
        setPixelColor(pixelOffset: number, rgb: number): void;
        showRainbow(startHue?: number, endHue?: number): void;
        showBarGraph(value: number, high: number): void;
        shift(offset?: number): void;
        rotate(offset?: number): void;
        getLength(): number;
        setMatrixWidth(width: number, rotation: number, chain: number): void;
        setMatrixColor(x: number, y: number, rgb: number): void;
        setPin(pin: DigitalPin): void;
    }

    export function create(pin: DigitalPin, numLeds: number, mode: NeoPixelMode): Strip;
    export function rgb(red: number, green: number, blue: number): number;
    export function pickColor(color: number): number;
    export function colors(color: NeoPixelColors): number;
    export function hsl(hue: number, saturation: number, luminance: number): number;

    export enum UARTDataType { X, Y, W, H, D }
    export enum ColorDataType { R, G, B, I }
    export enum ReturnFormat { String, Number }
    export enum FaceDataType { X, Y, Z, Yaw, Pitch, Mouth, LeftEye, RightEye, Roll, Smile, Visible }
    export enum HandDataType { LeftDir, LeftSpeed, RightDir, RightSpeed }

    export function parseUARTUnified(data: string, type: UARTDataType, format: ReturnFormat): any;
    export function parseColorUnified(data: string, color: ColorDataType, format: ReturnFormat): any;
    export function parseFaceUnified(data: string, type: FaceDataType): number;
    export function parseHandPoseUnified(data: string, type: HandDataType, format: ReturnFormat): any;

    export enum Display { On = 1, Off = 0 }
    
    export function invert(on?: boolean): void;
    export function clear(): void;
    export function display(on: boolean): void;
    export function pixel(x: number, y: number, color?: number): void;
    export function showString(text: string, column: number, row: number, color?: number): void;
    export function showNumber(number: number, column: number, row: number, color?: number): void;
    export function printString(text: string, newline?: boolean): void;
    export function printNumber(number: number, newline?: boolean): void;
    export function horizontalLine(x: number, y: number, length: number, color?: number): void;
    export function verticalLine(x: number, y: number, length: number, color?: number): void;
    export function rectangle(x1: number, y1: number, x2: number, y2: number, color?: number): void;
}
`;

// =========================================================================
// 3. 비트런(이족보행로봇) 확장블록 정의
// servos.P1 = 왼쪽 다리, servos.P2 = 오른쪽 다리 (연속회전 서보)
// 네오픽셀 LED 연결 시 항상 P0 고정 (표준 pxt-neopixel 라이브러리, ai_ponybot/vibeLamp와는 별개의 함수명 체계)
// =========================================================================
const BITRUN_EXTENSION = `
declare namespace servos {
    class Servo {
        run(speed: number): void;
        stop(): void;
    }
    const P1: Servo;
    const P2: Servo;
}

declare enum NeoPixelColors {
    Red = 0xFF0000,
    Orange = 0xFFA500,
    Yellow = 0xFFFF00,
    Green = 0x00FF00,
    Blue = 0x0000FF,
    Indigo = 0x4b0082,
    Violet = 0x8a2be2,
    Purple = 0xFF00FF,
    White = 0xFFFFFF,
    Black = 0x000000
}
declare enum NeoPixelMode {
    RGB = 1,
    RGBW = 2,
    RGB_RGB = 3
}
declare namespace neopixel {
    class Strip {
        showColor(rgb: number): void;
        showRainbow(startHue?: number, endHue?: number): void;
        showBarGraph(value: number, high: number): void;
        setPixelColor(pixeloffset: number, rgb: number): void;
        show(): void;
        clear(): void;
        length(): number;
        setBrightness(brightness: number): void;
        range(start: number, length: number): Strip;
        shift(offset?: number): void;
        rotate(offset?: number): void;
    }
    function create(pin: DigitalPin, numleds: number, mode: NeoPixelMode): Strip;
    function rgb(red: number, green: number, blue: number): number;
    function colors(color: NeoPixelColors): number;
    function hsl(h: number, s: number, l: number): number;
}
`;

// =========================================================================
// 🚀 [필수 설정] 백엔드(Cloud Functions) 접속 URL
// 구글 클라우드에서 배포 완료 후 받은 긴 URL을 아래 따옴표 안에 붙여넣으세요.
// =========================================================================
const CLOUD_FUNCTION_URL = "https://vibe-coding-proxy-750635720830.asia-northeast3.run.app";
const MODELS = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
const App = () => {
  // 접속키 상태 관리로 변경 (apiKey -> accessKey)
  const [accessKey, setAccessKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // 제품 상태 (ponybot / vibelamp)
  const [product, setProduct] = useState('ponybot');

  // 입력 의도: auto (현재 코드로 결정), new (한 번만 재작성), fix (동작 설명)
  const [promptMode, setPromptMode] = useState('auto');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [generatedCode, setGeneratedCode] = useState('// 여기에 AI가 생성한 코드가 나타납니다.');
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [fallbackCode, setFallbackCode] = useState('');
  const [repairContext, setRepairContext] = useState(null);
  const [codeStatus, setCodeStatus] = useState('unknown');
  const [showTour, setShowTour] = useState(false);
  const messagesEndRef = useRef(null);
  const promptRef = useRef(null);
  const inspectionRef = useRef(null);
  const repairSequence = useRef(0);
  const requestBusy = useRef(false);

  // 초기 인사말 설정 (제품 전환 시 변경)
  useEffect(() => {
    const productName = product === 'ponybot' ? 'AI 포니봇' : product === 'vibelamp' ? '바이브램프' : '비트런';
    setMessages([{
      role: 'assistant',
      text: `안녕하세요! ${productName} 바이브코딩 스튜디오에 오신 것을 환영합니다.\n만들고 싶은 동작이나 추가하고 싶은 기능을 알려주세요.\n\n💡 시작 전 우측 상단의 ⚙️(설정) 버튼에서 안내받은 접속키를 입력해주세요.`
    }]);
    setGeneratedCode('// 여기에 AI가 생성한 코드가 나타납니다.');
    setRepairContext(null);
    setFallbackCode('');
    setCopySuccess(false);
    setPromptMode('auto');
    setInput('');
  }, [product]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };
  useEffect(scrollToBottom, [messages]);

  // Placeholder 동적 설정
  const getPlaceholder = () => {
    if (promptMode === 'fix') return '원하는 동작과 실제 동작을 알려주세요. 예: 전진해야 하는데 뒤로 움직여요.';
    if (promptMode === 'new' || codeStatus === 'empty') return '어떤 동작을 만들고 싶나요? 예: A 버튼을 누르면 전진해줘.';
    if (codeStatus === 'existing') return '어떤 기능을 추가하거나 바꾸고 싶나요? 예: 장애물을 만나면 멈추게 해줘.';
    return '원하는 동작이나 바꾸고 싶은 내용을 설명해주세요.';
  };

  // MakeCode 탭에 지금 실제로 떠있는 코드(+컴파일 에러 마커)를 background를 거쳐
  // 라이브로 읽어옴 - 개선하기/에러 해결하기가 학생이 손으로 고친 블록을 놓치지 않도록 함
  const fetchLiveCode = async (tabId) => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return { ok: false, reason: 'NO_EXTENSION' };
    }
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'READ_CODE_REQUEST', tabId
      });
      return response || {
        ok: false,
        reason: 'NO_RESPONSE'
      };
    } catch (e) {
      return {
        ok: false,
        reason: 'ERROR'
      };
    }
  };

  const inspectProject = async () => {
    if (requestBusy.current || inspectionRef.current) return;
    setCodeStatus('checking');
    const pending = fetchLiveCode();
    inspectionRef.current = pending;
    try {
      const live = await pending;
      if (!requestBusy.current) setCodeStatus(live?.ok && typeof live.code === 'string' ? (isEmptyProject(live.code) ? 'empty' : 'existing') : 'unavailable');
    } finally { inspectionRef.current = null; }
  };
  useEffect(() => {
    inspectProject();
    const onFocus = () => inspectProject();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [product]);
  const describeProblem = context => {
    if (requestBusy.current) return;
    if (context) setRepairContext(context);
    setPromptMode('fix');
    promptRef.current?.focus();
  };

  // --- AI Logic (백엔드 프록시 통신으로 변경) ---
  const callGemini = async (prompt, systemInstruction) => {
    let lastError = null;
    for (const model of MODELS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(CLOUD_FUNCTION_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessKey}` // 접속키를 헤더에 담아서 전송
          },
          body: JSON.stringify({
            prompt: prompt,
            systemInstruction: systemInstruction,
            model: model
          })
        });
        const data = await response.json().catch(() => ({}));

        // 백엔드에서 에러(예: 401 접속키 틀림)를 반환한 경우
        if (!response.ok) {
          const error = new Error(data.error || `통신 오류 (${response.status})`);
          error.status = response.status;
          throw error;
        }
        if (typeof data.result !== 'string' || !data.result.trim()) throw new Error('AI가 빈 응답을 반환했습니다.');
        return data.result;
      } catch (err) {
        lastError = err;
        console.warn(`[${model}] Request failed:`, err);
        // 인증 에러(접속키 오류 등)일 경우 모델 순회를 멈추고 바로 에러를 띄웁니다.
        if (err.name === "AbortError") { lastError = new Error("응답 시간이 초과됐습니다. 다시 시도해주세요."); break; }
        if ([401, 403].includes(err.status) || err.message.includes("접속키")) break;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error("AI 호출에 실패했습니다.\n사유: " + lastError?.message);
  };
  const generateCode = async (autoRepair = false) => {
    autoRepair = autoRepair === true;
    if (requestBusy.current || (!autoRepair && !input.trim())) return;
    if (!accessKey) {
      setMessages(prev => [...prev, {
        role: 'user',
        text: autoRepair ? '오류 자동 수정하기' : input
      }, {
        role: 'system',
        text: '⚠️ 접속키가 입력되지 않았습니다. 우측 상단의 ⚙️(설정) 버튼을 눌러 접속키를 먼저 입력해주세요.'
      }]);
      setInput('');
      setShowSettings(true);
      return;
    }
    requestBusy.current = true;
    const userQuery = autoRepair ? (repairContext?.originalRequest || '현재 코드의 의도와 동작을 유지하면서 오류를 수정해줘.') : input;
    let mode = autoRepair ? 'fix' : promptMode;
    if (!autoRepair && promptMode !== 'fix') setRepairContext(null);
    setFallbackCode('');
    setCopySuccess(false);
    if (!autoRepair) setInput('');
    let modeLabel = "";
    if (mode === 'improve') modeLabel = "[코드 개선] ";
    if (mode === 'fix') modeLabel = "[에러 해결] ";
    setMessages(prev => [...prev, {
      role: 'user',
      text: autoRepair ? '오류 자동 수정하기' : modeLabel + userQuery
    }]);
    setIsLoading(true);

    // ================== 동적 시스템 프롬프트 조립 ==================
    // 1. 선언부
    let extensionSrc, robotName, neopixelPin;
    if (product === 'ponybot') {
      extensionSrc = PONYBOT_EXTENSION;
      robotName = "AI Ponybot";
      neopixelPin = "P8";
    } else if (product === 'vibelamp') {
      extensionSrc = VIBELAMP_EXTENSION;
      robotName = "Vibe Lamp";
      neopixelPin = "P8";
    } else {
      extensionSrc = BITRUN_EXTENSION;
      robotName = "BitRun";
      neopixelPin = "P0";
    }

    // 2. 라이트/디스플레이 섹션 (3번 규칙) - 비트런은 조명이 없어서 아예 생략
    let rule3;
    if (product === 'ponybot') {
      rule3 = `3. **LIGHT/NEOPIXEL USAGE:** - [CRITICAL] ONLY IF NeoPixels/Lights are needed, you MUST declare and initialize the strip variable at the top level:
   - [🚨 CRITICAL] Initialize it ONCE at the top level exactly like this: \`let strip = neopixel.create(DigitalPin.P8, 4, NeoPixelMode.RGB)\`
   - [🚨 CRITICAL] If you set the brightness, you MUST set it to 255 by default (e.g., \`strip.setBrightness(255)\`).
   - [🚨 CRITICAL COLOR OVERRIDE] You MUST use \`neopixel.getColors(NeoPixelColors.Red)\` to get a color value. NEVER use \`neopixel.colors(...)\`. Example: \`strip.showColor(neopixel.getColors(NeoPixelColors.Red))\``;
    } else if (product === 'vibelamp') {
      rule3 = `3. **LIGHT/NEOPIXEL USAGE:** - [CRITICAL] ONLY IF NeoPixels/Lights are needed, you MUST declare and initialize the strip variable at the top level:
   - [🚨 CRITICAL] Initialize it ONCE at the top level exactly like this: \`let strip = vibeLamp.create(DigitalPin.P8, 12, NeoPixelMode.RGB)\`
   - [🚨 CRITICAL] If you set the brightness, you MUST set it to 255 by default (e.g., \`strip.setBrightness(255)\`).
   - [🚨 CRITICAL COLOR OVERRIDE] You MUST use \`vibeLamp.colors(NeoPixelColors.Red)\` to get a color value. NEVER use \`vibeLamp.getColors(...)\`. Example: \`strip.showColor(vibeLamp.colors(NeoPixelColors.Red))\``;
    } else {
      rule3 = `3. **LIGHT/NEOPIXEL USAGE:** - [CRITICAL] ONLY IF NeoPixel LEDs are needed, you MUST declare and initialize the strip variable at the top level. This robot's NeoPixel LEDs are ALWAYS wired to pin P0 — never any other pin:
   - [🚨 CRITICAL] Initialize it ONCE at the top level exactly like this: \`let strip = neopixel.create(DigitalPin.P0, 8, NeoPixelMode.RGB)\` (adjust the LED count if the user specifies one; use 8 as a reasonable default otherwise).
   - [🚨 CRITICAL] If you set the brightness, you MUST set it to 255 by default (e.g., \`strip.setBrightness(255)\`).
   - [🚨 CRITICAL COLOR] You MUST use \`neopixel.colors(NeoPixelColors.Red)\` to get a color value. Example: \`strip.showColor(neopixel.colors(NeoPixelColors.Red))\``;
    }

    // 3. LED 매트릭스/디스플레이 섹션 (8번 규칙) - 비트런은 OLED가 없어서 매트릭스 안내만
    let rule8;
    if (product === 'ponybot') {
      rule8 = `8. **LED MATRIX vs NEOPIXEL vs OLED (INTELLIGENT UI/UX):**
   - If the user asks to display basic shapes like "LED", "아이콘", "하트", use the Micro:bit's built-in 5x5 LED matrix (e.g., \`basic.showIcon(...)\`).
   - If the user asks for "포니봇 LED", "네오픽셀", use the \`neopixel\` extension.
   - If the user asks for "OLED", "화면", "디스플레이", "글자 출력", you MUST use \`aiPonybot.showString(...)\` or \`aiPonybot.showNumber(...)\`.
   - [OLED - Intelligent Output] When displaying data on the OLED (128x64 resolution):
     * Combine Text and Graphics: Use \`rectangle\`, \`horizontalLine\`, \`verticalLine\` intelligently alongside text (\`showString\`, \`showNumber\`) to make the output intuitive (e.g., bar graphs for sensor data).
     * Full Canvas Utilization: Always consider the entire 128x64 canvas.`;
    } else if (product === 'vibelamp') {
      rule8 = `8. **LED MATRIX vs NEOPIXEL vs OLED (INTELLIGENT UI/UX):**
   - If the user asks for "화면", "디스플레이", "글자 출력", you MUST use \`vibeLamp.showString(...)\` or \`vibeLamp.showNumber(...)\`.
   - If the user asks for "라이트", "네오픽셀", you MUST use \`strip.showColor(...)\` or \`strip.showRainbow(...)\`.
   - [OLED - Intelligent Output] When displaying data on the OLED (128x64 resolution):
     * Combine Text and Graphics: Use \`rectangle\`, \`horizontalLine\`, \`verticalLine\` intelligently alongside text (\`showString\`, \`showNumber\`) to make the output intuitive (e.g., bar graphs for sensor data).
     * Full Canvas Utilization: Always consider the entire 128x64 canvas.`;
    } else {
      rule8 = `8. **LED MATRIX vs NEOPIXEL (INTELLIGENT UI/UX):**
   - This robot has NO OLED display. NEVER attempt to use \`showString\`, \`showNumber\`, \`rectangle\`, \`horizontalLine\`, or \`verticalLine\`.
   - If the user asks to display simple facial expressions, icons, or emotions ("표정", "웃는 얼굴", "화남"), use the Micro:bit's built-in 5x5 LED matrix (e.g., \`basic.showIcon(...)\`, \`basic.showLeds(...)\`).
   - If the user asks for "네오픽셀", "LED 색", "조명 효과", use the \`neopixel\` extension on \`strip\` (see rule 3).`;
    }

    // 4. 메모리/데이터 처리 섹션 (11번 규칙)
    let rule11;
    if (product === 'vibelamp') {
      rule11 = `11. **[🚨 CRITICAL] HARDWARE MEMORY & 070 ERROR PREVENTION (VIBE LAMP ONLY):**
                    - [🚨 3-COMBO BAN] You are STRICTLY FORBIDDEN from using NeoPixel, Bluetooth, and OLED display functions all together in the same program. Using all three causes a 070 memory crash. You may use (NeoPixel + Bluetooth) OR (OLED + Bluetooth), but NEVER all three. If the user explicitly asks to use all three, DO NOT write the code. Instead, return EXACTLY this string and nothing else:
                    // ⚠️ 마이크로비트 메모리 한계(070 에러)로 인해 네오픽셀, 블루투스, OLED를 동시에 사용할 수 없어요. 두 가지만 선택해주세요.
                    - [BT + NEOPIXEL INIT] If using BOTH Bluetooth (\`bluetooth\`) and NeoPixels, you MUST initialize them at the top level in this EXACT order: 1) \`bluetooth.startUartService()\`, 2) \`basic.pause(500)\`, 3) Initialize the strip.
                    - [NO MUSIC ALLOWED] If Bluetooth (\`bluetooth\`) is used, you are STRICTLY FORBIDDEN from using any functions from the \`music\` namespace.
                    - [UART EVENT DEFERRAL] NEVER call OLED or NeoPixel drawing functions directly inside \`bluetooth.onUartDataReceived\`. Parse and save data to global variables, and draw inside \`basic.forever\`.
                    - [DATA PARSING] When handling UART data, always check if the string is not empty before parsing.`;
    } else {
      rule11 = `11. **[🚨 CRITICAL] BLUETOOTH & NEOPIXEL CONFLICT (HARDWARE LIMITATION):**
    - Due to a Micro:bit hardware/memory limitation, Bluetooth (\`bluetooth\`) communication and NeoPixel (\`neopixel\`) LED control CANNOT run at the same time in the same program on this robot.
    - If the user's request requires BOTH Bluetooth communication AND NeoPixel LED effects together, you MUST:
      1. PRIORITIZE Bluetooth — write and include ONLY the Bluetooth-related functionality in the code.
      2. COMPLETELY OMIT all NeoPixel/\`strip\` code — do not declare, initialize, reference, or call any \`neopixel\` functions.
      3. In your natural-language explanation (Rule 6), clearly and kindly tell the user in Korean that Bluetooth and NeoPixel LEDs cannot be used at the same time on this robot's hardware, and that you implemented the Bluetooth part only.
      4. ALSO add this exact comment as the very first line of the generated code itself (so it survives as a comment block even if the user never reads the chat explanation): \`// ⚠️ 블루투스와 네오픽셀은 동시 사용이 안 돼서, 이번엔 블루투스만 구현했어요\`
    - This restriction does NOT apply if only Bluetooth OR only NeoPixel is requested (not both) — implement that one normally.
    - **DATA TYPE & PARSING:** MakeCode is statically typed. Never change a variable's data type after initialization. When handling UART or serial communication data (e.g., \`parseUARTUnified\`), always ensure to check if the string is not empty before parsing.`;
    }

    // 5. 이동 제어 섹션 (12번 규칙) - 로봇마다 완전히 다른 내용, 바이브램프는 모터가 없어서 생략
    let rule12;
    if (product === 'ponybot') {
      rule12 = `12. **MOTOR CONTROL SPECIFICATION (MECANUM vs NORMAL):**
    - [CRITICAL: PONYBOT PHYSICAL DIRECTION OVERRIDE] This robot's rotation enum names are opposite to their usual English meanings. The user observed that CounterClockwise physically turns RIGHT (clockwise). Use the mapping below; NEVER infer physical direction from the enum's English name.
    - Forward (전진): \`aiPonybot.runNormal(aiPonybot.DirectionControl.Forward, speed)\`.
    - Backward (후진): \`aiPonybot.runNormal(aiPonybot.DirectionControl.Backward, speed)\`.
    - Turn LEFT (좌회전, 왼쪽으로 회전): \`aiPonybot.runNormal(aiPonybot.DirectionControl.Clockwise, speed)\`. NEVER use CounterClockwise for a requested left turn.
    - Turn RIGHT (우회전, 오른쪽으로 회전): \`aiPonybot.runNormal(aiPonybot.DirectionControl.CounterClockwise, speed)\`. NEVER use Clockwise for a requested right turn.
    - Stop (정지): \`aiPonybot.stopAllMotors()\`.
    - Rotation changes the robot's heading. Lateral/diagonal movement (게걸음, 평행 이동, 수평 이동) keeps its heading and uses \`aiPonybot.runMecanum(...)\` with \`Mecanum\` instead.
    - Slide LEFT (왼쪽 평행 이동): \`aiPonybot.runMecanum(aiPonybot.Mecanum.Left, speed)\`.
    - Slide RIGHT (오른쪽 평행 이동): \`aiPonybot.runMecanum(aiPonybot.Mecanum.Right, speed)\`.
    - When improving or fixing existing code, apply this physical mapping to the requested turn even if the old code uses the opposite enum. Preserve unrelated behavior and the existing/requested speed.
    - Explain directions using the robot's physical movement, not a literal translation of the enum name. This override applies ONLY to AI Ponybot, not BitRun.`;
    } else if (product === 'bitrun') {
      rule12 = `12. **[🚨 CRITICAL] LEG DIRECTION CONTROL (servos.P1 = LEFT leg, servos.P2 = RIGHT leg):**
    - You MUST use EXACTLY these speed/sign combinations for movement. NEVER invent other combinations — this is a mechanical bipedal walking linkage, not a wheel, and wrong signs can make the legs fight each other.
    - Forward (전진): \`servos.P1.run(speed)\`, \`servos.P2.run(-speed)\`
    - Backward (후진): \`servos.P1.run(-speed)\`, \`servos.P2.run(speed)\`
    - Turn left in place (좌회전): \`servos.P1.run(-speed)\`, \`servos.P2.run(-speed)\`
    - Turn right in place (우회전): \`servos.P1.run(speed)\`, \`servos.P2.run(speed)\`
    - Stop (정지): \`servos.P1.stop()\`, \`servos.P2.stop()\` — NEVER use \`run(0)\` to stop a leg.
    - Unless the user specifies a value, use a speed magnitude between 30 and 80 — very low speeds may not produce enough torque to walk.`;
    } else {
      rule12 = "";
    }

    const systemPrompt = `
You are an expert MakeCode JavaScript/TypeScript programmer for the "${robotName}" based on BBC Micro:bit V2.
Your ONLY goal is to write complete, runnable code for the BBC Micro:bit V2 based on the user's request.

[🚨 ZERO HALLUCINATION POLICY 🚨]
You are STRICTLY FORBIDDEN from inventing any functions, methods, enums, or properties for custom extensions.
If a custom extension function is not explicitly listed in the declaration below, IT DOES NOT EXIST.

[EXACT LIBRARY DECLARATIONS]
\`\`\`typescript
${extensionSrc}
\`\`\`

RULES:
1. **STRICT COMPLIANCE & NAMESPACES:** - Use ONLY the functions defined above for the robot's specific features.
   - [🚨 CRITICAL ENUM PREFIX] You MUST strictly prefix ALL custom enums with their namespace (e.g., \`aiPonybot.PingUnit.Centimeters\`).
   - [🚨 NEOPIXEL EXCEPTION (CRITICAL)] Even though \`NeoPixelMode\` and \`NeoPixelColors\` might appear inside the \`neopixel\` or \`vibeLamp\` namespace in the declaration, MakeCode treats them as GLOBAL. You MUST NOT prefix them with \`neopixel.\` or \`vibeLamp.\`. 
   * CORRECT: \`NeoPixelMode.RGB\`, \`NeoPixelColors.Red\`
   * WRONG: \`neopixel.NeoPixelMode.RGB\`, \`neopixel.NeoPixelColors.Red\`
2. **ALLOWANCE FOR BUILT-IN NAMESPACES:** You are FULLY AUTHORIZED to use standard BBC Micro:bit MakeCode built-in namespaces (\`basic\`, \`input\`, \`led\`, \`pins\`, \`radio\`, \`Math\`, \`control\`, \`bluetooth\`).
${rule3}
4. **BLOCK CONVERSION RULE (CRITICAL FOR MAKECODE):**
   - [SHARED VARIABLES] Initialize shared state at the top level. Do NOT move loop-local counters to the top level. Local declarations are allowed when needed; there is no blanket ban on local \`let\`.
   - [CRITICAL: BLOCK-CONVERTIBLE FOR LOOPS] Declare the counter INSIDE the for initializer, starting at zero: \`for (let index = 0; index < 6; index++) { ... }\` repeats six times. The condition must use that same counter on the left with \`<\` or \`<=\`, and the increment must be \`index++\`. Use a distinct counter for nested loops.
   - NEVER generate \`for (index = 0; index < 6; index++)\` for a loop-local counter: omitting the declaration can turn the entire loop into a grey JavaScript block. The \`for (let ...)\` form is required even inside functions, event handlers, or \`basic.forever\`.
   - When fixing an existing grey for-loop, preserve the loop body and repetition count. If the old counter is also read or written outside the loop, preserve that shared-state behavior explicitly rather than blindly changing its scope. Do not change \`< 6\` to \`<= 6\`, which would add an extra iteration.
   - [🚨 MUST INITIALIZE] You MUST initialize variables with a value upon declaration (e.g., \`let x = 0;\`, \`let s = "";\`). NEVER write just \`let x;\`.
   - [🚨 NO TYPE ANNOTATIONS & MUTATION] NEVER use explicit type annotations (e.g., \`: number\`). Use Type Inference (e.g., \`let dist = 0\`). MakeCode is statically typed, so NEVER change a variable's data type after initialization.
5. **STARTUP / TOP-LEVEL CODE:** - Do NOT use \`basic.onStart()\`. In MakeCode, code written at the top-level acts as the "on start" block.
   - Place all initialization code directly at the top level of the file.
6. **OUTPUT FORMAT & EDUCATION:** - Output a friendly and encouraging explanation (2~3 sentences in Korean) FIRST. Briefly explain HOW the coding logic connects to the physical robot hardware.
   - THEN, output the actual code wrapped in a markdown code block (\`\`\`typescript ... \`\`\`).
7. **OLED DISPLAY COLOR:** When using display functions ALWAYS set the color parameter to \`1\` (ON) so the text is visible.
${rule8}
9. **EVENT HANDLERS & PIN CONFLICTS:** - NEVER place event handlers (like \`input.onButtonPressed\`) inside loops.
   - Never use the dedicated NeoPixel pin (DigitalPin.${neopixelPin}) for any other sensors or inputs.
   - [🚨 CRITICAL] For Micro:bit V2 logo touch ("로고 터치", "로고 누름"), you MUST use \`input.onLogoEvent(TouchButtonEvent.Pressed, ...)\` INSTEAD OF \`input.onPinPressed(...)\`.
10. **LOOP YIELDING & SCREEN OPTIMIZATION:** - If you use a \`while\` loop, you MUST include \`basic.pause(20)\` inside the loop body to prevent freezing.
    - [🚨 OLED FLICKER PREVENTION (CRITICAL)] When animating on the OLED, NEVER use \`clear()\` inside the loop. Follow the "Partial Update" pattern:
      1. Declare \`let oldX = 0; let oldY = 0;\` globally.
      2. ERASE old object: draw same shape with \`color: 0\` at \`oldX\`, \`oldY\`.
      3. DRAW new object: \`color: 1\` at \`x\`, \`y\`.
      4. UPDATE: \`oldX = x; oldY = y;\`.
${rule11}
${rule12}
13. **[🚨 GUARDRAIL] PRIVACY PROTECTION:** If the prompt contains ANY personal information, return EXACTLY:
// ⚠️ 바이브코딩 스튜디오는 개인정보를 수집하지 않으며, 관련 답변을 할 수 없어요
14. **[🚨 GUARDRAIL] OFF-TOPIC PREVENTION:** If the prompt is chit-chat, return EXACTLY:
// ⚠️ 수업과 관련된 바이브코딩 프롬프트를 넣어주세요.
15. **[🚨 CONTEXT AWARENESS]** If EXISTING CODE is provided and the user wants to IMPROVE or FIX it: Keep the core structure and apply changes. If they ask to "start over", IGNORE existing code.
16. **KOREAN NAMES FOR USER-DEFINED FUNCTIONS:** Name every NEW user-defined function in meaningful Korean Hangul so students can understand its purpose in the function blocks. Examples: \`function 좌회전하기() { ... }\`, \`function 몸떨기() { ... }\`, \`function 장애물피하기() { ... }\`. Do not use English names such as \`turnLeft\` or \`shiver\` for newly created functions.
    - Use valid identifiers without spaces or hyphens. Use exactly the same Korean name at every call site and callback reference; avoid name collisions.
    - This applies ONLY to functions defined by the generated user program. NEVER translate or rename MakeCode/library APIs, namespaces, methods, enum members, or language keywords (e.g., \`basic.pause\`, \`input.onButtonPressed\`, \`aiPonybot.runNormal\`, \`servos.P1.run\`). Anonymous event callbacks may remain anonymous. Variable names do not need to be translated.
    - In improve/fix mode, preserve existing function names unless renaming is requested; apply Korean naming to newly added functions. If renaming is requested, update the declaration and ALL references together without changing behavior.
`;

    // ================== 모드별 사용자 쿼리 조립 ==================
    let finalQuery = userQuery;
    try {
    if (inspectionRef.current) await inspectionRef.current;
    const live = await fetchLiveCode((autoRepair || promptMode === 'fix') ? repairContext?.tabId : undefined);
    if (!live?.ok || typeof live.code !== 'string') {
      setCodeStatus('unavailable');
      throw new Error(live?.message || 'MakeCode 프로젝트를 열고 다시 시도해주세요.');
    }
    setCodeStatus(isEmptyProject(live.code) ? 'empty' : 'existing');
    mode = generationMode(mode, live.code);
    if (!autoRepair && promptMode === 'new') setPromptMode('auto');
    const knownConversionFailure = autoRepair && repairContext && live.tabId === repairContext.tabId
      && live.modelUri === repairContext.modelUri && live.code === repairContext.failedCode;
    if (autoRepair && !(live.markers || []).some(m => m.severity === 8) && !knownConversionFailure) {
      setRepairContext(null);
      setMessages(prev => [...prev, { role: 'assistant', text: '현재 코드에서 컴파일 오류는 감지되지 않았어요. 원하는 동작과 실제 동작이 어떻게 다른지 아래 입력창에 설명해주세요.' }]);
      return;
    }
    if (mode === 'improve' || mode === 'fix') {
      const liveCode = live.code || '';
      const codeIsEmpty = liveCode.trim() === '';
      if (autoRepair && codeIsEmpty) throw new Error('수정할 코드가 없습니다. MakeCode 프로젝트를 확인해주세요.');
      const errorMarkers = (live.markers || []).filter(m => m.severity === 8);
      if (!codeIsEmpty && mode === 'improve') {
        finalQuery = `[기존 코드]\n${liveCode}\n\n[개선 및 추가 요청 사항]\n위 기존 코드의 뼈대를 유지하면서 다음 요청을 반영해줘: ${userQuery}`;
      } else if (!codeIsEmpty && mode === 'fix') {
        const markerText = errorMarkers.length > 0 ? `\n\n[컴파일러가 감지한 에러]\n${errorMarkers.map(m => `- ${m.startLineNumber}번째 줄: ${m.message}`).join('\n')}` : '';
        finalQuery = `[기존 코드]\n${liveCode}${markerText}\n\n[문제 상황 및 에러 해결 요청]\n위 기존 코드에서 다음 논리적 문제가 발생했어. 원인을 파악해서 해결된 전체 코드를 줘: ${userQuery}`;
      }
    }
      if (autoRepair) finalQuery += '\n\n[자동 수정 지침]\n' +
        (knownConversionFailure ? '이 코드는 블록 변환에 실패했습니다. 문법 오류와 블록 변환 형식, 제품 확장 API를 확인하세요. ' : '컴파일러가 감지한 오류를 수정하세요. ') +
        '원래 의도한 동작을 유지하며 필요한 부분만 수정하고 전체 코드를 반환하세요. 설명에는 무엇이 문제였고 어떻게 수정했는지 학생이 이해할 수 있게 한국어로 알려주세요. 실제 하드웨어 동작을 확인했다고 단정하지 마세요.';
      const aiCodeRaw = await callGemini(finalQuery, systemPrompt);

      const parsed = parseCodeResponse(aiCodeRaw);
      if (parsed.refusal) {
        setMessages(prev => [...prev, { role: 'system', text: parsed.refusal }]);
        return;
      }
      const aiCode = parsed.code;
      setGeneratedCode(aiCode);
      try {
        const applied = await chrome.runtime.sendMessage({
          type: 'CODE_READY', code: aiCode, tabId: live.tabId,
          expectedCode: live.code, modelUri: live.modelUri
        });
        if (!applied?.ok) {
          if (applied?.reason === 'BLOCK_CONVERSION_FAILED' && applied.keptJavaScript) {
            const context = { id: ++repairSequence.current, originalRequest: userQuery, tabId: live.tabId, modelUri: live.modelUri, failedCode: aiCode };
            setRepairContext(context);
            setFallbackCode(aiCode);
            setCodeStatus('existing');
            setMessages(prev => [...prev, { role: 'system', repairId: context.id, text: '블록으로 바꾸는 중 문제가 생겼어요. 작성한 코드는 보관되어 있어요.' }]);
            return;
          }
          throw new Error(applied?.message || 'MakeCode 반영에 실패했습니다.');
        }
      } catch (error) {
        setFallbackCode(aiCode);
        throw new Error(`${error.message || 'MakeCode 반영을 확인하지 못했습니다.'}\n필요하면 아래 ‘생성 코드 복사’ 버튼으로 이번 생성 결과를 복사할 수 있습니다.`);
      }
      setRepairContext(null);
      setCodeStatus(isEmptyProject(aiCode) ? 'empty' : 'existing');
      if (!autoRepair) setPromptMode('auto');
      const finalExplanation = '코드를 반영하고 블록 화면으로 전환했습니다.' +
        (parsed.explanation ? '\n\n💡 간단 설명:\n' + parsed.explanation : '');
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: finalExplanation
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'system',
        text: `오류 발생: ${error.message}`
      }]);
    } finally {
      requestBusy.current = false;
      setIsLoading(false);
    }
  };

  // 사이드패널은 폭이 좁아서 별도 설명 패널 대신,
  // 코드 설명을 채팅 메시지로 자연스럽게 끼워넣음
  // - 개선하기/에러 해결하기와 마찬가지로, 학생이 손으로 고친 블록까지
  //   반영되도록 설명 대상도 MakeCode의 실제 최신 코드를 라이브로 읽어옴
  const handleExplainCode = async () => {
    if (requestBusy.current) return;
    if (!accessKey) {
      setMessages(prev => [...prev, {
        role: 'system',
        text: '⚠️ 접속키가 입력되지 않았습니다. 설정에서 접속키를 입력해주세요.'
      }]);
      setShowSettings(true);
      return;
    }
    requestBusy.current = true;
    setMessages(prev => [...prev, {
      role: 'user',
      text: '📖 지금 코드 설명해줘'
    }]);
    setIsLoading(true);
    try {
      const live = await fetchLiveCode();
      if (!live || !live.ok || !live.code || live.code.trim() === '') {
        const reasonText = live && live.reason === 'NO_TAB' ? 'MakeCode 탭이 열려있지 않은 것 같아요. MakeCode를 먼저 열어주세요.' : '지금 MakeCode에 작성된 코드를 불러오지 못했어요.';
        setMessages(prev => [...prev, {
          role: 'system',
          text: `⚠️ ${reasonText}`
        }]);
        setIsLoading(false);
        return;
      }
      const systemPrompt = "You are a kind coding tutor. Explain the provided MakeCode JavaScript/TypeScript code to a beginner student in Korean. Break it down step-by-step. Keep it encouraging and easy to understand. Use emojis.";
      const explanation = await callGemini(live.code, systemPrompt);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: explanation
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'system',
        text: `설명을 가져오지 못했습니다: ${error.message}`
      }]);
    } finally {
      requestBusy.current = false;
      setIsLoading(false);
    }
  };
  const handleCopyCode = () => {
    if (!fallbackCode || requestBusy.current) return;
    const textArea = document.createElement("textarea");
    textArea.value = fallbackCode;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      if (!document.execCommand('copy')) throw new Error('클립보드 복사가 허용되지 않았습니다.');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setCopySuccess(false);
      setMessages(prev => [...prev, { role: 'system', text: '코드를 복사하지 못했습니다. 브라우저에 포커스를 두고 다시 눌러주세요.' }]);
    } finally {
      document.body.removeChild(textArea);
    }
  };
  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      generateCode();
    }
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    id: "studio-content",
    className: "flex flex-col h-screen w-full bg-white text-[#111] overflow-hidden relative"
  }, /*#__PURE__*/React.createElement("header", {
    "data-tour": "studio-header",
    className: "shrink-0 z-50 bg-black relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-3 py-2 border-b border-[#333]"
  }, /*#__PURE__*/React.createElement("a", {
    href: "https://boundaryx.io",
    target: "_blank",
    rel: "noreferrer",
    className: "flex items-center gap-2 min-w-0 transition-opacity hover:opacity-80"
  }, /*#__PURE__*/React.createElement("img", {
    src: "https://raw.githubusercontent.com/boundary-x/ai_voice_recognition/refs/heads/main/boundaryx_logo.png",
    alt: "Boundary X",
    className: "h-5 w-auto shrink-0"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-white text-sm font-bold truncate",
    title: "바이브코딩 스튜디오"
  }, "바이브코딩 스튜디오")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    "data-tour": "access-settings",
    onClick: () => setShowSettings(!showSettings),
    className: "studio-icon-button text-[#999] hover:text-white transition-colors",
    title: "접속키 설정"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa-solid fa-gear text-base",
    "aria-hidden": true
  })), /*#__PURE__*/React.createElement("a", {
    href: "https://boundaryx.io/shop",
    target: "_blank",
    rel: "noreferrer",
    className: "text-[#999] hover:text-white transition-colors",
    title: "제품 정보"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa-solid fa-arrow-up-right-from-square text-sm"
  })))), /*#__PURE__*/React.createElement("div", {
    "data-tour": "product-tabs",
    className: "flex px-2 py-2 gap-1.5"
  }, /*#__PURE__*/React.createElement("button", {
    disabled: isLoading,
    onClick: () => { if (!requestBusy.current) setProduct('ponybot'); },
    className: `flex-1 px-2 py-1.5 text-xs font-bold rounded-md transition-all ${product === 'ponybot' ? 'bg-white text-black shadow-sm' : 'bg-[#222] text-[#999] hover:text-white'}`
  }, "🤖 AI 포니봇"), /*#__PURE__*/React.createElement("button", {
    disabled: isLoading,
    onClick: () => { if (!requestBusy.current) setProduct('bitrun'); },
    className: `flex-1 px-2 py-1.5 text-xs font-bold rounded-md transition-all ${product === 'bitrun' ? 'bg-white text-black shadow-sm' : 'bg-[#222] text-[#999] hover:text-white'}`
  }, "🚶 비트런"), /*#__PURE__*/React.createElement("button", {
    disabled: isLoading,
    onClick: () => { if (!requestBusy.current) setProduct('vibelamp'); },
    className: `flex-1 px-2 py-1.5 text-xs font-bold rounded-md transition-all ${product === 'vibelamp' ? 'bg-white text-black shadow-sm' : 'bg-[#222] text-[#999] hover:text-white'}`
  }, "💡 바이브램프")), showSettings && /*#__PURE__*/React.createElement("div", {
    className: "absolute top-full left-3 right-3 mt-2 p-5 bg-white rounded-2xl shadow-2xl border border-[#D1D5DB] z-[100] animate-fade-in text-[#111]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa-solid fa-key text-[#EA4335] mr-2"
  }), "접속키(API Key) 설정"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowSettings(false),
    className: "text-[#999] hover:text-black transition-colors"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa-solid fa-xmark text-lg"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#666] mb-4"
  }, "안내받은 접속키(API Key)를 입력해주세요."), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "접속키를 입력해주세요!",
    value: accessKey,
    onChange: e => setAccessKey(e.target.value),
    className: "w-full bg-[#F8F9FA] border border-[#D1D5DB] rounded-lg p-2.5 text-sm text-[#111] mb-4 focus:ring-1 focus:ring-black focus:border-black outline-none"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowSettings(false),
    className: "px-4 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-[#333] w-full transition-colors"
  }, "확인 및 닫기")))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 flex flex-col overflow-hidden relative bg-[#F8F9FA]"
  }, /*#__PURE__*/React.createElement("div", {
    "data-tour": "chat-history",
    className: "flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
  }, messages.map((msg, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`
  }, /*#__PURE__*/React.createElement("div", {
    className: `max-w-[90%] p-3.5 rounded-2xl text-[0.9rem] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-black text-white rounded-tr-none' : msg.role === 'system' ? 'bg-[#FFF5F5] text-[#EA4335] border border-[#FECACA]' : 'bg-white text-[#111] rounded-tl-none border border-[#E5E7EB]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "whitespace-pre-wrap"
  }, msg.text), msg.repairId && (repairContext?.id === msg.repairId ? /*#__PURE__*/React.createElement("div", { className: "repair-actions" },
    /*#__PURE__*/React.createElement("button", { type: "button", disabled: isLoading, title: "현재 코드와 오류를 읽어 자동으로 수정합니다", onClick: () => generateCode(true) }, "오류 자동 수정하기"),
    /*#__PURE__*/React.createElement("button", { type: "button", disabled: isLoading, onClick: () => describeProblem(repairContext) }, "문제 설명하고 수정하기")
  ) : /*#__PURE__*/React.createElement("span", { className: "repair-expired" }, "이 안내는 종료됐어요. 현재 코드를 기준으로 요청해주세요."))))) , isLoading && /*#__PURE__*/React.createElement("div", {
    className: "flex justify-start"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center border border-[#E5E7EB]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-2 h-2 bg-[#666] rounded-full animate-bounce"
  }), /*#__PURE__*/React.createElement("div", {
    className: "w-2 h-2 bg-[#666] rounded-full animate-bounce delay-75"
  }), /*#__PURE__*/React.createElement("div", {
    className: "w-2 h-2 bg-[#666] rounded-full animate-bounce delay-150"
  }))), /*#__PURE__*/React.createElement("div", {
    ref: messagesEndRef
  })), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-white border-t border-[#D1D5DB] space-y-2 shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    "data-tour": "code-tools",
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleExplainCode,
    disabled: isLoading,
    className: "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bx-pill-btn bx-btn-outline text-xs",
    title: "이 코드가 무슨 뜻인지 설명해줘요"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa-solid fa-book-open text-[#137333]"
  }), "설명"), fallbackCode && /*#__PURE__*/React.createElement("button", {
    onClick: handleCopyCode,
    disabled: isLoading,
    className: "flex items-center justify-center gap-1.5 px-3 py-1.5 bx-pill-btn bx-btn-outline text-xs",
    title: "자동 반영되지 않은 이번 AI 생성 코드를 복사합니다"
  }, copySuccess ? /*#__PURE__*/React.createElement("i", {
    className: "fa-solid fa-check text-xs"
  }) : /*#__PURE__*/React.createElement("i", {
    className: "fa-regular fa-copy text-xs"
  }), copySuccess ? "복사 완료" : "생성 코드 복사"), /*#__PURE__*/React.createElement("button", {
    disabled: isLoading,
    onClick: () => {
      if (requestBusy.current) return;
      setGeneratedCode("// 초기화됨");
      setRepairContext(null);
      setFallbackCode('');
      setCopySuccess(false);
      setMessages([{
        role: 'assistant',
        text: '대화를 초기화했어요. MakeCode에 작성한 코드는 그대로 유지됩니다.'
      }]);
      setPromptMode('auto');
    },
    className: "w-9 h-9 flex items-center justify-center bg-[#F8F9FA] border border-[#D1D5DB] rounded-full hover:bg-[#FFF5F5] hover:text-[#EA4335] transition-colors shrink-0",
    title: "대화 초기화"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa-regular fa-trash-can text-xs"
  }))), /*#__PURE__*/React.createElement("div", { className: "composer-mode", "data-tour": "code-context" },
    /*#__PURE__*/React.createElement("select", {
      className: "composer-mode-select", "aria-label": "코드 작성 방식", value: promptMode, disabled: isLoading,
      "aria-describedby": promptMode === 'new' ? 'replace-code-note' : undefined,
      onChange: e => {
        if (requestBusy.current) return;
        if (e.target.value === 'fix') describeProblem(null);
        else setPromptMode(e.target.value);
      }
    }, /*#__PURE__*/React.createElement("option", { value: 'auto' }, '자동 — 현재 코드에 맞춰 작성'),
       /*#__PURE__*/React.createElement("option", { value: 'new' }, '처음부터 새로 만들기'),
       /*#__PURE__*/React.createElement("option", { value: 'fix' }, '동작 문제 해결하기')),
    promptMode === 'new' && /*#__PURE__*/React.createElement("p", { id: "replace-code-note", className: "composer-replace-note", role: "status" }, '이번 요청은 기존 코드를 교체합니다.'),
    codeStatus === 'unavailable' && /*#__PURE__*/React.createElement("div", { className: "composer-status", role: "status" },
      'MakeCode 프로젝트를 열고 다시 확인해주세요. ',
      /*#__PURE__*/React.createElement("button", { type: "button", disabled: isLoading, onClick: inspectProject }, '다시 확인')),
    codeStatus === 'checking' && /*#__PURE__*/React.createElement("p", { className: "composer-status", role: "status" }, '현재 코드를 확인하고 있습니다…'),
    promptMode === 'fix' && !repairContext && /*#__PURE__*/React.createElement("button", { className: "composer-repair", type: "button", disabled: isLoading, title: "현재 코드와 오류를 읽어 자동으로 수정합니다", onClick: () => generateCode(true) }, '오류 자동 수정하기')
  ), /*#__PURE__*/React.createElement("div", {
    "data-tour": "prompt-composer",
    className: "relative shadow-sm rounded-2xl"
  }, /*#__PURE__*/React.createElement("textarea", {
    ref: promptRef,
    "aria-label": "코딩 요청",
    value: input,
    onChange: e => setInput(e.target.value),
    onKeyDown: handleKeyDown,
    placeholder: getPlaceholder(),
    className: "w-full bg-[#F8F9FA] text-[#111] p-3 pr-14 rounded-2xl border border-[#D1D5DB] focus:ring-1 focus:ring-black focus:border-black outline-none resize-none h-[80px] scrollbar-hide text-[0.85rem] transition-all placeholder:text-[#999]"
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute right-2.5 bottom-2.5"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: generateCode,
    disabled: isLoading,
    title: "전송하기",
    className: "w-8 h-8 flex items-center justify-center bg-black text-white rounded-full hover:bg-[#333] disabled:opacity-50 transition-colors shadow-md"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa-solid fa-paper-plane text-xs"
  })))))), /*#__PURE__*/React.createElement("footer", {
    className: "bg-black text-white px-3 py-2 border-t border-[#222] shrink-0 text-[11px] flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", { className: "footer-brand" }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Boundary X"), /*#__PURE__*/React.createElement("button", { type: "button", className: "help-button", disabled: isLoading, onClick: () => { setShowSettings(false); setShowTour(true); } }, "사용법 알아보기")), /*#__PURE__*/React.createElement("span", {
    className: "text-[#666]"
  }, "© 2024"))), showTour && /*#__PURE__*/React.createElement(StudioTour, { onClose: () => setShowTour(false) }));
};
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));
