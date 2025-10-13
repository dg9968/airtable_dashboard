import Image from 'next/image';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'main' | 'icon';
  className?: string;
  priority?: boolean;
}

export default function TaxProLogo({ 
  size = 'medium', 
  variant = 'main',
  className = '',
  priority = false
}: LogoProps) {
  
  const sizeConfig = {
    small: {
      width: 48,
      height: 48,
      containerClass: 'w-12 h-12'
    },
    medium: {
      width: 80,
      height: 80,
      containerClass: 'w-20 h-20'
    },
    large: {
      width: 128,
      height: 128,
      containerClass: 'w-32 h-32'
    }
  };

  const config = sizeConfig[size];
  
  // Choose logo file based on variant and size for optimal performance
  let logoSrc = '/logo.png';
  
  // Use optimized versions if available
  if (variant === 'icon') {
    logoSrc = '/logo-icon.png';
  } else if (size === 'small') {
    logoSrc = '/logo-small.png';
  }

  return (
    <div className={`${config.containerClass} relative ${className}`}>
      <Image
        src={logoSrc}
        alt="Tax Pro Operations Logo"
        width={config.width}
        height={config.height}
        priority={priority}
        className="object-contain w-full h-full drop-shadow-lg hover:drop-shadow-xl transition-all duration-300"
        onError={(e) => {
          // Graceful fallback to main logo if optimized version doesn't exist
          const target = e.target as HTMLImageElement;
          if (target.src !== '/logo.png') {
            target.src = '/logo.png';
          }
        }}
        // Add loading optimization
        sizes={`${config.width}px`}
        quality={90}
      />
    </div>
  );
}