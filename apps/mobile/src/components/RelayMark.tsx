import Svg, { Circle, Line } from 'react-native-svg';
import { colors } from '../theme';

interface RelayMarkProps {
  width?: number;
  activeStep?: number;
  color?: string;
}

export function RelayMark({ width = 112, activeStep = 3, color = colors.blue }: RelayMarkProps) {
  const gap = width / 5;
  return (
    <Svg width={width} height={22} viewBox={`0 0 ${width} 22`} accessibilityLabel="FieldRelay six-node event trace">
      <Line x1={5} y1={11} x2={width - 5} y2={11} stroke={colors.rule} strokeWidth={1.5} />
      {Array.from({ length: 6 }).map((_, index) => {
        const step = index + 1;
        const x = 5 + index * gap;
        const completed = step <= activeStep;
        return (
          <Circle
            key={step}
            cx={x}
            cy={11}
            r={completed ? 4.2 : 3.4}
            fill={completed ? color : colors.surface}
            stroke={completed ? color : colors.muted}
            strokeWidth={1.4}
          />
        );
      })}
    </Svg>
  );
}

