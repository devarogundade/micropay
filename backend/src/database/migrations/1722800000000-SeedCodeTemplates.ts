import type { MigrationInterface, QueryRunner } from 'typeorm';

type SeedTemplate = {
  slug: string;
  name: string;
  description: string;
  category: string;
  projectName: string;
  activePath: string;
  featured: boolean;
  files: Array<{ path: string; content: string }>;
};

const templates: SeedTemplate[] = [
  {
    slug: 'milestone-escrow',
    name: 'Milestone Escrow',
    description:
      'A staged payment state machine for freelance work, grants, and bounties.',
    category: 'payments',
    projectName: 'milestone-escrow',
    activePath: 'contracts/MilestoneEscrow.algo.ts',
    featured: true,
    files: [
      {
        path: 'contracts/MilestoneEscrow.algo.ts',
        content: `import { Contract, GlobalState, uint64 } from '@algorandfoundation/algorand-typescript'

/** Staged escrow state machine. Add account checks and inner payments before production use. */
export class MilestoneEscrow extends Contract {
  totalMilestones = GlobalState<uint64>({ key: 'total', initialValue: 0 })
  approvedMilestones = GlobalState<uint64>({ key: 'approved', initialValue: 0 })
  releasedAmount = GlobalState<uint64>({ key: 'released', initialValue: 0 })

  createApplication(total: uint64): void {
    this.totalMilestones.value = total
  }

  approveNext(amount: uint64): uint64 {
    this.approvedMilestones.value = this.approvedMilestones.value + 1
    this.releasedAmount.value = this.releasedAmount.value + amount
    return this.releasedAmount.value
  }

  progress(): uint64 {
    return this.approvedMilestones.value
  }
}
`,
      },
      {
        path: 'README.md',
        content:
          '# Milestone Escrow\n\nA compact state machine for staged releases. Ask the IDE assistant to add creator/client authorization, grouped deposits, and inner payment releases.\n',
      },
    ],
  },
  {
    slug: 'community-voting',
    name: 'Community Signal',
    description:
      'A transparent proposal and weighted-signal contract for communities and DAOs.',
    category: 'governance',
    projectName: 'community-signal',
    activePath: 'contracts/CommunitySignal.algo.ts',
    featured: true,
    files: [
      {
        path: 'contracts/CommunitySignal.algo.ts',
        content: `import { Contract, GlobalState, uint64 } from '@algorandfoundation/algorand-typescript'

/** Minimal weighted signal board. Extend with voter boxes to prevent duplicate votes. */
export class CommunitySignal extends Contract {
  proposalId = GlobalState<uint64>({ key: 'proposal', initialValue: 0 })
  yesWeight = GlobalState<uint64>({ key: 'yes', initialValue: 0 })
  noWeight = GlobalState<uint64>({ key: 'no', initialValue: 0 })

  createApplication(): void {}

  openProposal(id: uint64): void {
    this.proposalId.value = id
    this.yesWeight.value = 0
    this.noWeight.value = 0
  }

  voteYes(weight: uint64): uint64 {
    this.yesWeight.value = this.yesWeight.value + weight
    return this.yesWeight.value
  }

  voteNo(weight: uint64): uint64 {
    this.noWeight.value = this.noWeight.value + weight
    return this.noWeight.value
  }
}
`,
      },
      {
        path: 'README.md',
        content:
          '# Community Signal\n\nA weighted proposal signal board. Ask the assistant to add box-backed voter receipts, proposal deadlines, and ASA-based voting power.\n',
      },
    ],
  },
  {
    slug: 'token-gated-club',
    name: 'Token-Gated Club',
    description:
      'Membership tiers and access epochs for token-gated communities or digital products.',
    category: 'membership',
    projectName: 'token-gated-club',
    activePath: 'contracts/TokenGatedClub.algo.ts',
    featured: true,
    files: [
      {
        path: 'contracts/TokenGatedClub.algo.ts',
        content: `import { Contract, GlobalState, uint64 } from '@algorandfoundation/algorand-typescript'

/** Membership configuration for an ASA-gated product. */
export class TokenGatedClub extends Contract {
  membershipAsset = GlobalState<uint64>({ key: 'asset', initialValue: 0 })
  minimumBalance = GlobalState<uint64>({ key: 'minimum', initialValue: 1 })
  accessEpoch = GlobalState<uint64>({ key: 'epoch', initialValue: 1 })

  createApplication(assetId: uint64, minimum: uint64): void {
    this.membershipAsset.value = assetId
    this.minimumBalance.value = minimum
  }

  rotateAccess(): uint64 {
    this.accessEpoch.value = this.accessEpoch.value + 1
    return this.accessEpoch.value
  }

  getAccessEpoch(): uint64 {
    return this.accessEpoch.value
  }
}
`,
      },
      {
        path: 'README.md',
        content:
          '# Token-Gated Club\n\nMembership configuration for gated content. Ask the assistant to validate transaction accounts against ASA holdings and add tier-specific boxes.\n',
      },
    ],
  },
  {
    slug: 'api-credit-meter',
    name: 'On-Chain API Credits',
    description:
      'A prepaid usage meter for AI agents, APIs, games, and machine-to-machine services.',
    category: 'infrastructure',
    projectName: 'api-credit-meter',
    activePath: 'contracts/ApiCreditMeter.algo.ts',
    featured: true,
    files: [
      {
        path: 'contracts/ApiCreditMeter.algo.ts',
        content: `import { Contract, GlobalState, uint64 } from '@algorandfoundation/algorand-typescript'

/** Global service meter starter. Replace aggregate state with per-user boxes for production. */
export class ApiCreditMeter extends Contract {
  creditsIssued = GlobalState<uint64>({ key: 'issued', initialValue: 0 })
  creditsConsumed = GlobalState<uint64>({ key: 'consumed', initialValue: 0 })
  unitPrice = GlobalState<uint64>({ key: 'price', initialValue: 1 })

  createApplication(price: uint64): void {
    this.unitPrice.value = price
  }

  issue(amount: uint64): uint64 {
    this.creditsIssued.value = this.creditsIssued.value + amount
    return this.creditsIssued.value
  }

  consume(units: uint64): uint64 {
    this.creditsConsumed.value = this.creditsConsumed.value + units
    return this.creditsConsumed.value
  }

  remaining(): uint64 {
    return this.creditsIssued.value - this.creditsConsumed.value
  }
}
`,
      },
      {
        path: 'README.md',
        content:
          '# On-Chain API Credits\n\nA prepaid usage meter. Ask the assistant to add per-customer boxes, payment verification, admin authorization, and usage receipts.\n',
      },
    ],
  },
];

export class SeedCodeTemplates1722800000000 implements MigrationInterface {
  name = 'SeedCodeTemplates1722800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const template of templates) {
      await queryRunner.query(
        `INSERT INTO "CodeTemplate" ("slug", "name", "description", "category", "projectName", "activePath", "files", "featured", "clonedCount", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 0, now(), now())
         ON CONFLICT ("slug") DO UPDATE SET
           "name" = EXCLUDED."name",
           "description" = EXCLUDED."description",
           "category" = EXCLUDED."category",
           "projectName" = EXCLUDED."projectName",
           "activePath" = EXCLUDED."activePath",
           "files" = EXCLUDED."files",
           "featured" = EXCLUDED."featured",
           "archivedAt" = NULL,
           "updatedAt" = now()`,
        [
          template.slug,
          template.name,
          template.description,
          template.category,
          template.projectName,
          template.activePath,
          JSON.stringify(template.files),
          template.featured,
        ],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM "CodeTemplate" WHERE "slug" = ANY($1::varchar[])',
      [templates.map((template) => template.slug)],
    );
  }
}
