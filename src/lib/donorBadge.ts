// Donor Recognition Tier & Security Verification Token Engine
// Generates official digital recognition cards & badges for voluntary blood donors.

import type { BloodGroup } from '../types';

export type DonorTierId = 'newbie' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface DonorTierInfo {
  id: DonorTierId;
  nameBn: string;
  nameEn: string;
  minDonations: number;
  maxDonations: number;
  badgeColor: string;
  badgeTextColor: string;
  badgeBg: string;
  ribbonColor: string;
  accentGradient: [string, string];
  icon: string;
}

export const DONOR_TIERS: readonly DonorTierInfo[] = [
  {
    id: 'bronze',
    nameBn: 'রক্তযোদ্ধা (ব্রোঞ্জ)',
    nameEn: 'Bronze Lifesaver',
    minDonations: 1,
    maxDonations: 2,
    badgeColor: '#B45309',
    badgeTextColor: '#78350F',
    badgeBg: '#FEF3C7',
    ribbonColor: '#CD7F32',
    accentGradient: ['#B45309', '#D97706'],
    icon: '🥉',
  },
  {
    id: 'silver',
    nameBn: 'রৌপ্য জীবনদাতা (সিলভার)',
    nameEn: 'Silver Guardian',
    minDonations: 3,
    maxDonations: 5,
    badgeColor: '#475569',
    badgeTextColor: '#1E293B',
    badgeBg: '#F1F5F9',
    ribbonColor: '#94A3B8',
    accentGradient: ['#475569', '#64748B'],
    icon: '🥈',
  },
  {
    id: 'gold',
    nameBn: 'সুবর্ণ অভিভাবক (গোল্ড)',
    nameEn: 'Golden Champion',
    minDonations: 6,
    maxDonations: 10,
    badgeColor: '#D97706',
    badgeTextColor: '#92400E',
    badgeBg: '#FFFBEB',
    ribbonColor: '#F59E0B',
    accentGradient: ['#D97706', '#FBBF24'],
    icon: '🥇',
  },
  {
    id: 'platinum',
    nameBn: 'প্লাটিনাম কিংবদন্তি',
    nameEn: 'Platinum Legend',
    minDonations: 11,
    maxDonations: Infinity,
    badgeColor: '#0284C7',
    badgeTextColor: '#075985',
    badgeBg: '#F0F9FF',
    ribbonColor: '#38BDF8',
    accentGradient: ['#0284C7', '#0EA5E9'],
    icon: '💎',
  },
] as const;

/**
 * Returns tier information based on verified donation count
 */
export function getDonorTier(donationCount: number = 0): DonorTierInfo {
  if (donationCount >= 11) return DONOR_TIERS[3];
  if (donationCount >= 6) return DONOR_TIERS[2];
  if (donationCount >= 3) return DONOR_TIERS[1];
  return DONOR_TIERS[0];
}

/**
 * CYBER-SECURITY: Generates a deterministic, tamper-evident verification ID.
 * Example format: RD-8E2B-94F0
 */
export function generateBadgeVerificationId(
  donorUid: string,
  bloodGroup: BloodGroup,
  districtId: string = ''
): string {
  const seed = `${donorUid}:${bloodGroup}:${districtId}:roktodei_v1`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = ((h1 >>> 0) % 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const hex2 = ((h2 >>> 0) % 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `RD-${hex1}-${hex2}`;
}

/**
 * Official Digital Donor Recognition Card Canvas Engine
 */
export interface DonorCardCustomOptions {
  showPhone?: boolean;
  showLocation?: boolean;
  showUsername?: boolean;
  showStats?: boolean;
  showHospitalArea?: boolean;
}

export interface DonorCardRenderData {
  displayName: string;
  username?: string;
  bloodGroup: BloodGroup;
  districtName?: string;
  divisionName?: string;
  totalDonations: number;
  lastDonationDate?: string;
  donorUid: string;
  phoneNumber?: string;
  preferredHospitalArea?: string;
  lang: 'bn' | 'en';
  options?: DonorCardCustomOptions;
  logoImage?: HTMLImageElement | null;
}

interface DetailRowSpec {
  kind: 'phone' | 'location' | 'hospital';
  lines: string[];
}

/**
 * Renders the landscape Digital Blood Donor ID Card onto HTML5 Canvas.
 * Matches the bold crimson-facet top header + floating white Blood Group tab +
 * unboxed impact stats + curved bottom-right crimson ID ribbon, with zero QR code
 * and elastic height collapse when optional personal details are toggled off.
 */
export function renderDonorCardToCanvas(
  canvas: HTMLCanvasElement,
  donor: DonorCardRenderData
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 1040;
  const padX = 46;
  const contentW = width - padX * 2;

  const opts = donor.options || {};
  const showPhone = opts.showPhone !== false && Boolean(donor.phoneNumber);
  const showLocation =
    opts.showLocation !== false &&
    Boolean(donor.districtName || donor.divisionName);
  const showUsername = opts.showUsername !== false && Boolean(donor.username);
  const showHospitalArea =
    opts.showHospitalArea !== false && Boolean(donor.preferredHospitalArea);
  const showStats = opts.showStats !== false;

  const tier = getDonorTier(donor.totalDonations);
  const verifyId = generateBadgeVerificationId(
    donor.donorUid,
    donor.bloodGroup,
    donor.districtName || ''
  );

  // Measure text safely before finalizing dynamic height
  canvas.width = width;
  canvas.height = 900;

  const logoBoxSize = 114;
  const dividerX = padX + logoBoxSize + 24;
  const headerTextX = dividerX + 24;
  const headerTextMaxW = 550; // Leaves generous room for top-right pill & blood tab

  ctx.font = '700 38px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
  const nameLines = wrapCanvasLines(ctx, donor.displayName || 'Blood Donor', headerTextMaxW, 2);

  // Prepare collapsible detail rows (left side of white body)
  const detailRows: DetailRowSpec[] = [];
  if (showPhone && donor.phoneNumber) {
    detailRows.push({
      kind: 'phone',
      lines: [donor.phoneNumber],
    });
  }
  if (showLocation) {
    const locText = `${donor.districtName || (donor.lang === 'bn' ? 'বাংলাদেশ' : 'Bangladesh')}${
      donor.divisionName ? `, ${donor.divisionName}` : ''
    }`;
    ctx.font = '600 20px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
    detailRows.push({
      kind: 'location',
      lines: wrapCanvasLines(ctx, locText, 640, 1),
    });
  }
  if (showHospitalArea && donor.preferredHospitalArea) {
    const hospLabel =
      donor.lang === 'bn'
        ? `হাসপাতাল এলাকা: ${donor.preferredHospitalArea}`
        : `Hospital Area: ${donor.preferredHospitalArea}`;
    ctx.font = '500 18px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
    detailRows.push({
      kind: 'hospital',
      lines: wrapCanvasLines(ctx, hospLabel, 660, 2),
    });
  }

  // Pass 1: Dynamic vertical layout calculation (zero wasted blank space)
  const extraNameH = nameLines.length > 1 ? 42 : 0;
  const headerH = 236 + extraNameH;
  const tabOverlapBottom = headerH + 34; // Blood Group white card protrudes slightly below header curve

  let curY = headerH;
  const hasDetails = detailRows.length > 0;

  if (hasDetails) {
    curY += 32;
    detailRows.forEach((row, idx) => {
      const rowH = row.lines.length > 1 ? 48 : 28;
      curY += rowH + (idx < detailRows.length - 1 ? 12 : 0);
    });
    curY += 24;
  } else {
    // Ensure white Blood Group tab bottom never clips into stats/footer when details are hidden
    curY = Math.max(curY + 18, tabOverlapBottom + 14);
  }

  if (showStats) {
    if (hasDetails) curY += 1; // hairline divider
    curY += 22 + 78 + 24;
  }

  // Bottom hairline + white/crimson footer ribbon
  const footerH = 74;
  const totalHeight = Math.max(curY + footerH + 14, tabOverlapBottom + footerH + 22);

  canvas.width = width;
  canvas.height = totalHeight;

  // Clip rounded outer card silhouette
  ctx.clearRect(0, 0, width, totalHeight);
  ctx.save();
  roundRect(ctx, 0, 0, width, totalHeight, 28);
  ctx.clip();

  // 1. Clean Light Body Surface + Subtle Diagonal Satin Wash
  const bodyGrad = ctx.createLinearGradient(0, headerH - 30, width, totalHeight);
  bodyGrad.addColorStop(0, '#FFFFFF');
  bodyGrad.addColorStop(0.68, '#FAFBFD');
  bodyGrad.addColorStop(1, '#F1F5F9');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(0, 0, width, totalHeight);

  // Subtle geometric light facet on lower-right background + faint emblem watermark
  ctx.save();
  ctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
  ctx.beginPath();
  ctx.moveTo(width * 0.56, totalHeight);
  ctx.lineTo(width, headerH - 20);
  ctx.lineTo(width, totalHeight);
  ctx.closePath();
  ctx.fill();

  drawWatermarkEmblem(ctx, width - 145, Math.min(totalHeight - 165, headerH + 150), 105);
  ctx.restore();

  // ============================================================================
  // 2. TOP CRIMSON HEADER WITH CURVED RIGHT NOTCH & SATIN FACETS
  // ============================================================================
  const defineHeaderWavePath = (yOffset: number) => {
    const baseY = headerH + yOffset;
    const notchRightY = 172 + extraNameH + yOffset;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, notchRightY);
    ctx.lineTo(845, notchRightY);
    ctx.bezierCurveTo(792, notchRightY, 795, baseY, 735, baseY);
    ctx.lineTo(0, baseY);
    ctx.closePath();
  };

  ctx.save();
  defineHeaderWavePath(0);
  ctx.shadowColor = 'rgba(136, 3, 24, 0.22)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 5;

  const headerGrad = ctx.createLinearGradient(0, 0, width, headerH);
  headerGrad.addColorStop(0, '#D7092B');
  headerGrad.addColorStop(0.5, '#C20726');
  headerGrad.addColorStop(1, '#8C031A');
  ctx.fillStyle = headerGrad;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Clip inside crimson header for diagonal geometric facets & double accent trim
  ctx.clip();

  // Diagonal architectural red ribbons on right half (matching reference style)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.beginPath();
  ctx.moveTo(645, 0);
  ctx.lineTo(755, 0);
  ctx.lineTo(610, headerH);
  ctx.lineTo(500, headerH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.065)';
  ctx.beginPath();
  ctx.moveTo(755, 0);
  ctx.lineTo(855, 0);
  ctx.lineTo(710, headerH);
  ctx.lineTo(610, headerH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.11)';
  ctx.beginPath();
  ctx.moveTo(855, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, headerH);
  ctx.lineTo(710, headerH);
  ctx.closePath();
  ctx.fill();

  // Crisp parallel white accent trim along the bottom curve of the header
  const trimY = headerH - 6;
  const trimRightY = 172 + extraNameH - 6;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, trimY);
  ctx.lineTo(735, trimY);
  ctx.bezierCurveTo(795, trimY, 792, trimRightY, 845, trimRightY);
  ctx.lineTo(width, trimRightY);
  ctx.stroke();
  ctx.restore();

  // Top-Left White Rounded Logo Card
  const logoY = 38;
  ctx.save();
  roundRect(ctx, padX, logoY, logoBoxSize, logoBoxSize, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();

  if (donor.logoImage && donor.logoImage.complete && donor.logoImage.naturalWidth > 0) {
    ctx.drawImage(
      donor.logoImage,
      padX + 6,
      logoY + 6,
      logoBoxSize - 12,
      logoBoxSize - 12
    );
  } else {
    drawFallbackBrandMark(
      ctx,
      padX + logoBoxSize / 2,
      logoY + logoBoxSize / 2,
      36
    );
  }
  ctx.restore();

  // Vertical White Divider beside Logo
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dividerX, 38);
  ctx.lineTo(dividerX, headerH - 36);
  ctx.stroke();

  // Brand Title + Subtitle + Hero Donor Name + Tier/Username
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 28px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    donor.lang === 'bn' ? 'রক্তদেই · Rokto Dei' : 'Rokto Dei · রক্তদেই',
    headerTextX,
    64
  );

  ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
  ctx.font = '400 16px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    donor.lang === 'bn'
      ? 'স্বেচ্ছায় রক্তদাতা ডিজিটাল পরিচয়পত্র'
      : 'Voluntary Blood Donor Digital Credential',
    headerTextX,
    92
  );

  // Donor Display Name (Hero line)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 38px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
  nameLines.forEach((line, idx) => {
    ctx.fillText(line, headerTextX, 148 + idx * 42);
  });

  // Sub-line: Optional @username · Donor Tier (clean unboxed text, safely clamped)
  const subParts: string[] = [];
  if (showUsername && donor.username) subParts.push(`@${donor.username}`);
  subParts.push(donor.lang === 'bn' ? tier.nameBn : tier.nameEn);
  ctx.fillStyle = 'rgba(255, 241, 242, 0.92)';
  ctx.font = '600 14.5px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
  const subLineText = wrapCanvasLines(ctx, subParts.join('  ·  '), headerTextMaxW, 1)[0];
  ctx.fillText(subLineText, headerTextX, 182 + extraNameH);

  // Top-Right Translucent Glass Pill ("একটি মানবিক পরিচয়পত্র")
  const pillLabel =
    donor.lang === 'bn' ? 'একটি মানবিক পরিচয়পত্র' : 'Humanitarian Pass';
  ctx.font = '500 14px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
  const pillTextW = ctx.measureText(pillLabel).width;
  const pillW = pillTextW + 46;
  const pillH = 38;
  const pillX = width - padX - pillW;
  const pillY = 26;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.50)';
  ctx.lineWidth = 1.25;
  roundRect(ctx, pillX, pillY, pillW, pillH, 19);
  ctx.fill();
  ctx.stroke();

  drawLockIcon(ctx, pillX + 14, pillY + 10, 17, '#FFFFFF');
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(pillLabel, pillX + 37, pillY + 24);

  // Right Floating White Blood Group Tab Card
  const tabW = 204;
  const tabH = 152;
  const tabX = width - tabW;
  const tabY = 118 + extraNameH;

  ctx.save();
  // Rounded left corners, extending cleanly to right edge like reference image
  ctx.beginPath();
  ctx.moveTo(tabX + 26, tabY);
  ctx.lineTo(width, tabY);
  ctx.lineTo(width, tabY + tabH);
  ctx.lineTo(tabX + 26, tabY + tabH);
  ctx.arcTo(tabX, tabY + tabH, tabX, tabY + tabH - 26, 26);
  ctx.lineTo(tabX, tabY + 26);
  ctx.arcTo(tabX, tabY, tabX + 26, tabY, 26);
  ctx.closePath();

  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = -4;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Giant Crimson Blood Group Figure
  const tabCenterX = tabX + tabW / 2 - 4;
  ctx.fillStyle = '#C80828';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 54px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(donor.bloodGroup, tabCenterX, tabY + 54);
  ctx.textBaseline = 'alphabetic';

  // Thin horizontal hairline inside Blood Group Tab
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(tabX + 28, tabY + 95);
  ctx.lineTo(width - 28, tabY + 95);
  ctx.stroke();

  // Blood Drop Icon + "রক্তের গ্রুপ"
  const bgLabel = donor.lang === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group';
  ctx.font = '600 17px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
  const bgLabelW = ctx.measureText(bgLabel).width;
  const bgRowStartX = tabCenterX - (bgLabelW + 22) / 2;

  drawSolidDropletIcon(ctx, bgRowStartX + 7, tabY + 121, 9, '#C80828');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1E293B';
  ctx.fillText(bgLabel, bgRowStartX + 22, tabY + 127);
  ctx.restore();

  // ============================================================================
  // 3. MIDDLE CLEAN BODY (DETAILS + 3-COLUMN IMPACT STATS)
  // ============================================================================
  let bodyY = headerH;

  if (hasDetails) {
    bodyY += 32;

    detailRows.forEach((row, idx) => {
      if (row.kind === 'phone') {
        drawPhoneIcon(ctx, padX, bodyY + 1, 21, '#059669');
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0F172A';
        ctx.font = '600 19px "JetBrains Mono", monospace';
        ctx.fillText(row.lines[0], padX + 34, bodyY + 18);
      } else if (row.kind === 'location') {
        drawSolidMapPinIcon(ctx, padX, bodyY, 22, '#C80828');
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0F172A';
        ctx.font = '600 20px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
        ctx.fillText(row.lines[0], padX + 34, bodyY + 19);
      } else {
        drawHospitalBuildingIcon(ctx, padX, bodyY + 1, 21, '#1E293B');
        ctx.textAlign = 'left';
        ctx.fillStyle = '#1E293B';
        ctx.font = '500 18px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
        row.lines.forEach((line, lineIdx) => {
          ctx.fillText(line, padX + 34, bodyY + 18 + lineIdx * 23);
        });
      }

      const rowH = row.lines.length > 1 ? 48 : 28;
      bodyY += rowH + (idx < detailRows.length - 1 ? 12 : 0);
    });

    bodyY += 24;
  } else {
    bodyY = Math.max(bodyY + 18, tabOverlapBottom + 14);
  }

  // 3-Column Stats Row (Icon left + Big Number & Label right, matching reference!)
  if (showStats) {
    if (hasDetails) {
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(padX, bodyY);
      ctx.lineTo(width - padX, bodyY);
      ctx.stroke();
      bodyY += 1;
    }

    bodyY += 22;
    const colW = contentW / 3;

    // Col 1: Total Donations
    const col1X = padX + 14;
    drawUsersIcon(ctx, col1X, bodyY + 16, 48, '#C80828');

    ctx.textAlign = 'left';
    ctx.fillStyle = '#C80828';
    ctx.font = '800 38px "Plus Jakarta Sans", "Noto Sans Bengali", sans-serif';
    const countStr =
      donor.lang === 'bn'
        ? toBnNum(donor.totalDonations)
        : String(donor.totalDonations);
    ctx.fillText(countStr, col1X + 64, bodyY + 34);

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 15.5px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      donor.lang === 'bn' ? 'মোট রক্তদান' : 'Total Donations',
      col1X + 64,
      bodyY + 62
    );

    // Col 2: Potential Lives Impacted
    const col2X = padX + colW + 24;
    drawHeartHandIcon(ctx, col2X, bodyY + 12, 50, '#0F172A');

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 38px "Plus Jakarta Sans", "Noto Sans Bengali", sans-serif';
    const livesStr =
      donor.lang === 'bn'
        ? toBnNum(donor.totalDonations * 3)
        : String(donor.totalDonations * 3);
    ctx.fillText(livesStr, col2X + 64, bodyY + 34);

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 15.5px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      donor.lang === 'bn' ? 'সম্ভাব্য জীবন রক্ষা' : 'Lives Impacted',
      col2X + 64,
      bodyY + 62
    );

    // Col 3: Verified Donor Status
    const col3X = padX + colW * 2 + 24;
    drawSolidShieldCheckIcon(ctx, col3X, bodyY + 14, 48, '#22C55E');

    ctx.fillStyle = '#16A34A';
    ctx.font = '700 28px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      donor.lang === 'bn' ? 'ভেরিফায়েড' : 'Verified',
      col3X + 62,
      bodyY + 34
    );

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 15.5px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      donor.lang === 'bn' ? 'নিবন্ধিত রক্তদাতা' : 'Registered Donor',
      col3X + 62,
      bodyY + 62
    );

    // Crisp Vertical Hairline Separators
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(padX + colW, bodyY + 10);
    ctx.lineTo(padX + colW, bodyY + 68);
    ctx.moveTo(padX + colW * 2, bodyY + 10);
    ctx.lineTo(padX + colW * 2, bodyY + 68);
    ctx.stroke();

    bodyY += 78 + 24;
  }

  // ============================================================================
  // 4. BOTTOM FOOTER STRIP + SWEEPING CRIMSON ID RIBBON (NO QR CODE)
  // ============================================================================
  const footerTopY = totalHeight - footerH;

  // Hairline above left footer
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(padX, footerTopY - 6);
  ctx.lineTo(630, footerTopY - 6);
  ctx.stroke();

  // Left Footer Brand & Motto
  const footerTextY = footerTopY + 33;
  drawGlobeIcon(ctx, padX, footerTopY + 15, 22, '#0F172A');

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('www.roktodei.com', padX + 32, footerTextY);

  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(padX + 206, footerTopY + 14);
  ctx.lineTo(padX + 206, footerTopY + 42);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '500 15px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    donor.lang === 'bn'
      ? 'রক্ত দিন, জীবন বাঁচান'
      : 'DONATE BLOOD · SAVE LIVES',
    padX + 224,
    footerTextY
  );

  // Sweeping Bottom-Right Crimson Ribbon + Bottom Crimson Accent Trim
  const ribbonTopY = footerTopY;
  const ribbonStartX = 580;
  const ribbonCurveEndX = 668;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, totalHeight - 5);
  ctx.lineTo(ribbonStartX, totalHeight - 5);
  ctx.bezierCurveTo(
    ribbonStartX + 42,
    totalHeight - 5,
    ribbonCurveEndX - 42,
    ribbonTopY,
    ribbonCurveEndX,
    ribbonTopY
  );
  ctx.lineTo(width, ribbonTopY);
  ctx.lineTo(width, totalHeight);
  ctx.lineTo(0, totalHeight);
  ctx.closePath();

  const ribbonGrad = ctx.createLinearGradient(ribbonStartX, ribbonTopY, width, totalHeight);
  ribbonGrad.addColorStop(0, '#99041C');
  ribbonGrad.addColorStop(0.5, '#C80828');
  ribbonGrad.addColorStop(1, '#8C0319');
  ctx.fillStyle = ribbonGrad;
  ctx.fill();
  ctx.restore();

  // Right Crimson Ribbon Contents: ID Badge Icon + Token | Calendar Icon + Date
  const issueDate = new Date().toISOString().split('T')[0];
  const ribbonTextY = ribbonTopY + 41;
  const idStartX = 684;

  drawIdCardIcon(ctx, idStartX, ribbonTopY + 25, 20, '#FFFFFF');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  const idStr = `ID: ${verifyId}`;
  ctx.fillText(idStr, idStartX + 27, ribbonTextY);

  const sepX = idStartX + 27 + ctx.measureText(idStr).width + 14;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(sepX, ribbonTopY + 22);
  ctx.lineTo(sepX, ribbonTopY + 48);
  ctx.stroke();

  const calX = sepX + 14;
  drawCalendarIcon(ctx, calX, ribbonTopY + 25, 19, '#FFFFFF');
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillText(issueDate, calX + 26, ribbonTextY);

  ctx.restore();

  // Crisp subtle outer bevel border
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.95)';
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, width - 2, totalHeight - 2, 27);
  ctx.stroke();
}

/* ============================================================================
 * Canvas Text Wrapping & Crisp Vector Icon Helpers
 * ========================================================================== */

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const clean = text.trim();
  if (!clean) return [''];
  if (ctx.measureText(clean).width <= maxWidth) return [clean];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else if (!current) {
      lines.push(truncateToFit(ctx, word, maxWidth));
      if (lines.length >= maxLines) return lines;
    } else {
      lines.push(current);
      if (lines.length >= maxLines) {
        const prev = lines[maxLines - 1];
        lines[maxLines - 1] = truncateToFit(ctx, `${prev} ${word}`, maxWidth);
        return lines;
      }
      current = word;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

function truncateToFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawFallbackBrandMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
) {
  ctx.save();
  ctx.fillStyle = '#C80828';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.bezierCurveTo(cx + r * 0.9, cy - r * 0.1, cx + r * 0.85, cy + r * 0.9, cx, cy + r);
  ctx.bezierCurveTo(cx - r * 0.85, cy + r * 0.9, cx - r * 0.9, cy - r * 0.1, cx, cy - r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(cx - r * 0.14, cy - r * 0.08, r * 0.28, r * 0.56);
  ctx.fillRect(cx - r * 0.28, cy + r * 0.06, r * 0.56, r * 0.28);
  ctx.restore();
}

function drawWatermarkEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(200, 8, 40, 0.065)';
  ctx.fillStyle = 'rgba(200, 8, 40, 0.045)';
  ctx.lineWidth = 10;
  ctx.lineJoin = 'round';

  const r = size;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.85, cy - r * 0.55);
  ctx.lineTo(cx + r * 0.85, cy + r * 0.1);
  ctx.bezierCurveTo(cx + r * 0.85, cy + r * 0.65, cx + r * 0.4, cy + r * 0.95, cx, cy + r * 1.1);
  ctx.bezierCurveTo(cx - r * 0.4, cy + r * 0.95, cx - r * 0.85, cy + r * 0.65, cx - r * 0.85, cy + r * 0.1);
  ctx.lineTo(cx - r * 0.85, cy - r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner blood droplet silhouette
  ctx.fillStyle = 'rgba(200, 8, 40, 0.055)';
  const dr = r * 0.45;
  ctx.beginPath();
  ctx.moveTo(cx, cy - dr);
  ctx.bezierCurveTo(cx + dr * 0.85, cy - dr * 0.1, cx + dr * 0.8, cy + dr * 0.85, cx, cy + dr);
  ctx.bezierCurveTo(cx - dr * 0.8, cy + dr * 0.85, cx - dr * 0.85, cy - dr * 0.1, cx, cy - dr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLockIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.11);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = size / 24;

  roundRect(ctx, x + 5 * s, y + 11 * s, 14 * s, 10 * s, 2 * s);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + 12 * s, y + 11 * s, 4 * s, Math.PI, 0, false);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 12 * s, y + 16 * s, 1.4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSolidDropletIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.bezierCurveTo(cx + r * 0.88, cy - r * 0.08, cx + r * 0.82, cy + r * 0.88, cx, cy + r);
  ctx.bezierCurveTo(cx - r * 0.82, cy + r * 0.88, cx - r * 0.88, cy - r * 0.08, cx, cy - r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSolidMapPinIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  const s = size / 24;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y + 22 * s);
  ctx.bezierCurveTo(x + 12 * s, y + 22 * s, x + 19.5 * s, y + 14.8 * s, x + 19.5 * s, y + 9.5 * s);
  ctx.arc(x + 12 * s, y + 9.5 * s, 7.5 * s, 0, Math.PI, true);
  ctx.bezierCurveTo(x + 4.5 * s, y + 14.8 * s, x + 12 * s, y + 22 * s, x + 12 * s, y + 22 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + 12 * s, y + 9.5 * s, 2.8 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPhoneIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.75, size * 0.11);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = size / 24;

  ctx.beginPath();
  ctx.moveTo(x + 6.5 * s, y + 4 * s);
  ctx.lineTo(x + 9.5 * s, y + 4 * s);
  ctx.lineTo(x + 11 * s, y + 8.5 * s);
  ctx.lineTo(x + 8.8 * s, y + 10.2 * s);
  ctx.bezierCurveTo(x + 9.8 * s, y + 12.6 * s, x + 11.4 * s, y + 14.2 * s, x + 13.8 * s, y + 15.2 * s);
  ctx.lineTo(x + 15.5 * s, y + 13 * s);
  ctx.lineTo(x + 20 * s, y + 14.5 * s);
  ctx.lineTo(x + 20 * s, y + 17.5 * s);
  ctx.bezierCurveTo(x + 20 * s, y + 19.2 * s, x + 18.6 * s, y + 20.4 * s, x + 17 * s, y + 20.2 * s);
  ctx.bezierCurveTo(x + 9.2 * s, y + 19.2 * s, x + 4.8 * s, y + 14.8 * s, x + 3.8 * s, y + 7 * s);
  ctx.bezierCurveTo(x + 3.6 * s, y + 5.4 * s, x + 4.8 * s, y + 4 * s, x + 6.5 * s, y + 4 * s);
  ctx.stroke();
  ctx.restore();
}

function drawHospitalBuildingIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  const s = size / 24;

  // Roof triangle + pillars architectural hospital/institution mark
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y + 3 * s);
  ctx.lineTo(x + 21 * s, y + 8.5 * s);
  ctx.lineTo(x + 3 * s, y + 8.5 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(x + 5 * s, y + 10 * s, 2.5 * s, 8 * s);
  ctx.fillRect(x + 10.75 * s, y + 10 * s, 2.5 * s, 8 * s);
  ctx.fillRect(x + 16.5 * s, y + 10 * s, 2.5 * s, 8 * s);
  ctx.fillRect(x + 3 * s, y + 19 * s, 18 * s, 2.5 * s);
  ctx.restore();
}

function drawUsersIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  const s = size / 24;

  // Center figure
  ctx.beginPath();
  ctx.arc(x + 12 * s, y + 7 * s, 3.2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 6.5 * s, y + 19 * s);
  ctx.bezierCurveTo(x + 6.5 * s, y + 14 * s, x + 17.5 * s, y + 14 * s, x + 17.5 * s, y + 19 * s);
  ctx.closePath();
  ctx.fill();

  // Left subtle figure
  ctx.beginPath();
  ctx.arc(x + 5.2 * s, y + 9.2 * s, 2.4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 1.5 * s, y + 18.5 * s);
  ctx.bezierCurveTo(x + 1.5 * s, y + 15 * s, x + 6 * s, y + 15 * s, x + 6 * s, y + 18.5 * s);
  ctx.closePath();
  ctx.fill();

  // Right subtle figure
  ctx.beginPath();
  ctx.arc(x + 18.8 * s, y + 9.2 * s, 2.4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 18 * s, y + 18.5 * s);
  ctx.bezierCurveTo(x + 18 * s, y + 15 * s, x + 22.5 * s, y + 15 * s, x + 22.5 * s, y + 18.5 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeartHandIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  const s = size / 24;

  // Solid Heart above hand
  ctx.beginPath();
  ctx.moveTo(x + 14 * s, y + 11.2 * s);
  ctx.bezierCurveTo(x + 14 * s, y + 11.2 * s, x + 9 * s, y + 8 * s, x + 9 * s, y + 5.2 * s);
  ctx.arc(x + 11.5 * s, y + 5.2 * s, 2.5 * s, Math.PI, 0, false);
  ctx.arc(x + 16.5 * s, y + 5.2 * s, 2.5 * s, Math.PI, 0, false);
  ctx.bezierCurveTo(x + 19 * s, y + 8 * s, x + 14 * s, y + 11.2 * s, x + 14 * s, y + 11.2 * s);
  ctx.closePath();
  ctx.fill();

  // Open caring hand underneath
  ctx.beginPath();
  ctx.moveTo(x + 2 * s, y + 15 * s);
  ctx.lineTo(x + 5.5 * s, y + 15 * s);
  ctx.lineTo(x + 7.5 * s, y + 13.5 * s);
  ctx.lineTo(x + 13.5 * s, y + 13.5 * s);
  ctx.bezierCurveTo(x + 15 * s, y + 13.5 * s, x + 15.5 * s, y + 15.5 * s, x + 13.5 * s, y + 16 * s);
  ctx.lineTo(x + 19.5 * s, y + 14.5 * s);
  ctx.bezierCurveTo(x + 21.5 * s, y + 14 * s, x + 22 * s, y + 16.5 * s, x + 20 * s, y + 17.5 * s);
  ctx.lineTo(x + 12.5 * s, y + 20.5 * s);
  ctx.lineTo(x + 6 * s, y + 20.5 * s);
  ctx.lineTo(x + 2 * s, y + 19.5 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSolidShieldCheckIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  const s = size / 24;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y + 2 * s);
  ctx.lineTo(x + 20.5 * s, y + 5.5 * s);
  ctx.lineTo(x + 20.5 * s, y + 11.8 * s);
  ctx.bezierCurveTo(x + 20.5 * s, y + 16.8 * s, x + 16.8 * s, y + 20.6 * s, x + 12 * s, y + 22.2 * s);
  ctx.bezierCurveTo(x + 7.2 * s, y + 20.6 * s, x + 3.5 * s, y + 16.8 * s, x + 3.5 * s, y + 11.8 * s);
  ctx.lineTo(x + 3.5 * s, y + 5.5 * s);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 8.2 * s, y + 12.2 * s);
  ctx.lineTo(x + 11 * s, y + 15 * s);
  ctx.lineTo(x + 16.2 * s, y + 9.4 * s);
  ctx.stroke();
  ctx.restore();
}

function drawGlobeIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  const s = size / 24;
  const cx = x + 12 * s;
  const cy = y + 12 * s;

  ctx.beginPath();
  ctx.arc(cx, cy, 9.5 * s, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, 4.5 * s, 9.5 * s, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 2.8 * s, cy - 3 * s);
  ctx.lineTo(x + 21.2 * s, cy - 3 * s);
  ctx.moveTo(x + 2.8 * s, cy + 3 * s);
  ctx.lineTo(x + 21.2 * s, cy + 3 * s);
  ctx.stroke();
  ctx.restore();
}

function drawIdCardIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.09);
  const s = size / 24;

  roundRect(ctx, x + 2 * s, y + 4 * s, 20 * s, 16 * s, 2.5 * s);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + 8.5 * s, y + 10.5 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 14 * s, y + 9.5 * s);
  ctx.lineTo(x + 19 * s, y + 9.5 * s);
  ctx.moveTo(x + 14 * s, y + 13.5 * s);
  ctx.lineTo(x + 19 * s, y + 13.5 * s);
  ctx.stroke();
  ctx.restore();
}

function drawCalendarIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.09);
  ctx.lineCap = 'round';
  const s = size / 24;

  roundRect(ctx, x + 3 * s, y + 5 * s, 18 * s, 16 * s, 2.5 * s);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 8 * s, y + 3 * s);
  ctx.lineTo(x + 8 * s, y + 7 * s);
  ctx.moveTo(x + 16 * s, y + 3 * s);
  ctx.lineTo(x + 16 * s, y + 7 * s);
  ctx.moveTo(x + 3 * s, y + 10 * s);
  ctx.lineTo(x + 21 * s, y + 10 * s);
  ctx.stroke();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function toBnNum(num: number): string {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (d) => bn[parseInt(d, 10)]);
}
