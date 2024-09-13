use borsh::{BorshDeserialize, BorshSerialize};
use serde_json::json;
use solana_program::entrypoint;
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    sysvar::{rent::Rent, Sysvar},
};
use spl_associated_token_account::tools::account::create_pda_account;

use spl_token_2022::{instruction as token_instruction, state::Account, state::Mint};

// Define your program ID
solana_program::declare_id!("FTDJxoE7ZMrKu2kW3KEmhSCvqXegUugnPPYVMQThvqY9");

// Constants
const AUTHORITY_PUBKEY: Pubkey =
    solana_program::pubkey!("3tXoH9Vy1Ah6UzmS4byEVdi7ouHvaARY5XWkyGtVHZm8");
const TOTAL_SUPPLY: u64 = 1_000_000_000 * 1_000_000_000; // 1 billion tokens with 9 decimals
const REQUIRED_STAKE_AMOUNT: u64 = 1_000 * 1_000_000_000; // 1000 tokens with 9 decimals

pub enum BullPosterError {
    InvalidCompetitionStatus,
    CompetitionFull,
    UserAlreadyEnrolled,
    InsufficientTokens,
    // Add more as needed
}

impl From<BullPosterError> for ProgramError {
    fn from(e: BullPosterError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

// Instruction enum
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum BullPosterInstruction {
    InitializeProgram,
    CreateRaidProgram {
        name: String,                // Name of the raid program
        description: String,         // Description of the raid program
        profile_picture_url: String, // URL of the profile picture
    },
    CreateRaid {
        competition_type: String, // Type of the competition
    },
    AuthorityTransfer {
        amount: u64, // Amount to transfer
    },
    BurnTokens {
        burn_amount: u64, // Amount of tokens to burn
    },
    AcceptPVPRequest,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct TokenAccountCard {
    pub last_seen_raids: String, // JSON string with sequence number and competition id per competition type
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct BurnCard {
    pub raid_program_id: String,
    pub competition_id: String,
    pub user_id: Pubkey,
    pub burn_amount: u64,
    pub timestamp: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct RaidCard {
    pub competition_id: String,
    pub raid_program_id: String,
    pub raid_id: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct CompetitionCard {
    pub competition_id: String,
    pub competition_type: String,
    pub start_time: u64,
    pub end_time: u64,
    pub total_rewards_distributed: u64,
    pub status: String,            // "awaiting", "active", "finalized", "expired"
    pub enrolled_programs: String, // Comma-separated list of raid IDs
    pub required_programs: u64,
    pub challenger_program_id: Option<String>,
    pub challenged_program_id: Option<String>,
    pub start_expiration: Option<u64>, // Only for PvP competitions
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct RaidProgramCard {
    pub raid_program_id: String,
    pub name: String,
    pub description: String,
    pub user_key: Pubkey,
    pub profile_picture_url: String,
    pub last_seen_raids: String, // Json in string format which includes raid IDs per competition type
    pub is_conducting_raid: bool,
    pub active_raid_id: String, // ID of the current raid
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct EnrollmentCard {
    pub raid_program_id: String,
    pub user_key: Pubkey,
}

// Program entrypoint
#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(process_instruction);

// Instruction processor
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = BullPosterInstruction::try_from_slice(instruction_data)?;

    match instruction {
        BullPosterInstruction::InitializeProgram => {
            msg!("Instruction: Initialize Program");
            initialize_program(program_id, accounts)
        }
        BullPosterInstruction::CreateRaidProgram {
            name,
            description,
            profile_picture_url,
        } => {
            msg!("Instruction: Create BullPoster Program");
            initialize_raid_program(
                program_id,
                accounts,
                &name,
                description,
                profile_picture_url,
                REQUIRED_STAKE_AMOUNT,
            )
        }
        BullPosterInstruction::AuthorityTransfer { amount } => {
            msg!("Instruction: Authority Transfer");
            authority_transfer(program_id, accounts, amount)
        }
        BullPosterInstruction::CreateRaid { competition_type } => {
            msg!("Instruction: Create Raid");
            create_raid(program_id, accounts, competition_type)
        }
        BullPosterInstruction::AcceptPVPRequest {} => {
            msg!("Instruction: Accept PVP Request");
            accept_pvp_challenge(accounts)
        }
        BullPosterInstruction::BurnTokens { burn_amount } => {
            msg!("Instruction: Burn Tokens");
            burn_tokens_for_raid(program_id, accounts, burn_amount)
        }
    }
}

fn initialize_program(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let initializer = next_account_info(account_info_iter)?;
    let token_mint_account = next_account_info(account_info_iter)?;
    let token_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let rent = next_account_info(account_info_iter)?;

    if initializer.key != &AUTHORITY_PUBKEY {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Derive PDA for token mint
    let (token_mint_pda, mint_bump) =
        Pubkey::find_program_address(&[b"pda_token_mint"], program_id);
    if token_mint_account.key != &token_mint_pda {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Create token mint account as a PDA
    create_pda_account(
        initializer,                        // Payer for account creation
        &Rent::get()?,                      // Rent sysvar for calculating rent-exempt balance
        Mint::get_packed_len(),             // Size of the Mint struct
        token_program.key,                  // Owner of the new account (token program)
        system_program,                     // System program for creating the account
        token_mint_account,                 // The account being created
        &[b"pda_token_mint", &[mint_bump]], // Seeds for the PDA
    )?;

    // Initialize mint
    invoke_signed(
        &token_instruction::initialize_mint(
            token_program.key,     // Token program ID
            &token_mint_pda,       // Mint account to initialize
            &token_mint_pda,       // Mint authority
            Some(&token_mint_pda), // Freeze authority (optional)
            9,                     // Number of decimals for the mint
        )?,
        &[token_mint_account.clone(), rent.clone()],
        &[&[b"pda_token_mint", &[mint_bump]]],
    )?;

    // Derive PDA for token account
    let (token_account_pda, account_bump) =
        Pubkey::find_program_address(&[b"pda_token_account"], program_id);
    if token_account.key != &token_account_pda {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Create PDA-controlled token account
    create_pda_account(
        initializer,
        &Rent::get()?,
        Account::get_packed_len(),
        token_program.key,
        system_program,
        token_account,
        &[b"pda_token_account", &[account_bump]],
    )?;

    // Mint initial supply of tokens to the PDA-controlled token account
    invoke_signed(
        &token_instruction::mint_to(
            token_program.key,
            &token_mint_pda,
            &token_account_pda,
            &token_mint_pda,
            &[],
            TOTAL_SUPPLY,
        )?,
        &[
            token_mint_account.clone(),
            token_account.clone(),
            token_program.clone(),
        ],
        &[&[b"pda_token_mint", &[mint_bump]]],
    )?;

    // Initialize TokenAccountCard
    let token_account_card = TokenAccountCard {
        last_seen_raids: "{}".to_string(), // Initialize with empty JSON object
    };

    token_account_card.serialize(&mut &mut token_account.data.borrow_mut()[..])?;

    msg!("Token initialized and initial supply minted");
    Ok(())
}

pub fn initialize_raid_program(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    program_name: &str,
    description: String,
    profile_picture_url: String,
    stake_amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let user_token_account = next_account_info(account_info_iter)?;
    let raid_program_account = next_account_info(account_info_iter)?;
    let token_mint_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent = next_account_info(account_info_iter)?;

    msg!("Initializing Raid Program: {}", program_name);

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive PDA for Raid Program Account
    let raid_program_seed = format!("raid_program_{}_{}", user_account.key, program_name);
    let (raid_program_account_pda, bump) =
        Pubkey::find_program_address(&[raid_program_seed.as_bytes()], program_id);

    // Verify provided Raid Program Account matches derived PDA
    if raid_program_account.key != &raid_program_account_pda {
        msg!("Error: Raid Program Account does not match derived PDA");
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if account already exists
    if !raid_program_account.data_is_empty() {
        msg!("Raid Program Account is not empty");
        // verify account data is of the correct type
        return Err(ProgramError::InvalidAccountData);
    } else {
        // Account doesn't exist, create and initialize it
        // Create program account
        let raid_program_space = RaidProgramCard {
            raid_program_id: format!("{}_{}", user_account.key, program_name),
            name: program_name.to_string(),
            description: description.clone(),
            user_key: *user_account.key,
            profile_picture_url: profile_picture_url.clone(),
            last_seen_raids: String::new(),
            is_conducting_raid: false,
            active_raid_id: String::new(),
        };
        let mut buffer = Vec::new();
        raid_program_space.serialize(&mut buffer)?;
        let space = buffer.len();

        // let lamports = Rent::get()?.minimum_balance(space);

        msg!("Creating Raid Program PDA account...");
        create_pda_account(
            user_account,                             // The user initiating the transaction
            &Rent::get()?,                            // Required lamports for rent-exemption
            space,                                    // Size of the account to be created
            token_program.key,                        // Token program associated with this action
            system_program,                           // System program for creating the account
            raid_program_account,                     // The PDA account for the raid program
            &[raid_program_seed.as_bytes(), &[bump]], // Seeds for generating PDA and the bump seed
        )?;

        msg!("Initializing account...");
        invoke_signed(
            &token_instruction::initialize_account3(
                token_program.key,         // Token program ID
                raid_program_account.key,  // The PDA account for the raid program
                token_mint_account.key,    // The mint associated with the token
                &raid_program_account_pda, // The PDA derived from the program seed
            )?,
            &[
                raid_program_account.clone(), // The raid program PDA account
                token_mint_account.clone(),   // The mint account for the tokens
                raid_program_account.clone(), // Rent-exempt account
                rent.clone(),                 // Rent account
            ],
            &[&[raid_program_seed.as_bytes(), &[bump]]], // Seeds for generating PDA for signing
        )?;
    }

    // Transfer tokens from user to Raid Program account
    msg!(
        "Transferring {} tokens to Raid Program account",
        stake_amount
    );
    invoke(
        &token_instruction::transfer(
            token_program.key,        // Token program ID
            user_token_account.key,   // User's token account (source of tokens)
            raid_program_account.key, // Destination: the raid program account
            user_account.key,         // User account (payer and authority)
            &[],                      // No additional signers
            stake_amount,             // Amount of tokens to transfer
        )?,
        &[
            user_token_account.clone(),   // Source account for the tokens
            raid_program_account.clone(), // Destination account (raid program PDA)
            user_account.clone(),         // Authority account of the user
            token_program.clone(),        // Token program involved in the transfer
        ],
    )?;

    // Serialize program data
    let program_data = RaidProgramCard {
        raid_program_id: format!("{}_{}", user_account.key, program_name),
        name: program_name.to_string(),
        description,
        user_key: *user_account.key,
        profile_picture_url,
        last_seen_raids: String::new(),
        is_conducting_raid: false,
        active_raid_id: String::new(),
    };
    program_data.serialize(&mut &mut raid_program_account.data.borrow_mut()[..])?;

    msg!("BullPoster Raid Program initialized successfully");
    msg!("Raid Program account: {:?}", raid_program_account.key);
    msg!("Staked amount: {}", stake_amount);

    Ok(())
}

fn burn_tokens_for_raid(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    burn_amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?; // User's main account (signer)
    let user_token_account = next_account_info(account_info_iter)?; // User's token account (source of tokens)
    let burn_card_account = next_account_info(account_info_iter)?; // Account to store burn information
    let token_program = next_account_info(account_info_iter)?; // SPL Token program
    let token_mint_account = next_account_info(account_info_iter)?; // Token mint account
    let system_program = next_account_info(account_info_iter)?; // System program
    let rent = next_account_info(account_info_iter)?; // Rent sysvar
    let raid_program_account = next_account_info(account_info_iter)?; // Account storing raid program data
    let competition_account = next_account_info(account_info_iter)?; // Account storing competition data
    let enrollment_card_account = next_account_info(account_info_iter)?; // Account proving user's enrollment

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Obtain raid program id
    let raid_program_data: RaidProgramCard =
        RaidProgramCard::try_from_slice(&raid_program_account.data.borrow())?;
    let raid_program_id = raid_program_data.raid_program_id;

    // Obtain competition card data and verify that raid id is inclunded in enrolled programs
    let competition_data: CompetitionCard =
        CompetitionCard::try_from_slice(&competition_account.data.borrow())?;
    let enrolled_programs: Vec<&str> = competition_data.enrolled_programs.split(',').collect();
    if !enrolled_programs.contains(&raid_program_id.as_str()) {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify competition card account is active and has not been completed
    if competition_data.status != "active" {
        return Err(ProgramError::InvalidAccountData);
    }

    // If active verify not past end time
    if Clock::get()?.unix_timestamp as u64 >= competition_data.end_time {
        return Err(ProgramError::InvalidAccountData);
    }

    // Proof of Enrollment must be provided from user burning tokens for a raid
    let enrollment_card_account_data: EnrollmentCard =
        EnrollmentCard::try_from_slice(&enrollment_card_account.data.borrow())?;
    if *user_account.key != enrollment_card_account_data.user_key {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if enrollment_card_account_data.raid_program_id != raid_program_id {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify that burn card account is not initialized (empty)
    if !burn_card_account.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Derive PDA for burn account
    let burn_seed = format!(
        "burn_{}_{}_{}",
        user_account.key,
        raid_program_id,
        Clock::get()?.unix_timestamp as u64
    );
    let (burn_card_account_pda, bump) =
        Pubkey::find_program_address(&[burn_seed.as_bytes()], program_id);

    // Verify that the provided burn_card_account matches the derived PDA
    if burn_card_account.key != &burn_card_account_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Create burn card account
    let burn_space = BurnCard {
        raid_program_id: raid_program_id.clone(),
        competition_id: competition_data.competition_id.clone(),
        user_id: *user_account.key,
        burn_amount,
        timestamp: Clock::get()?.unix_timestamp as u64,
    };
    let mut buffer = Vec::new();
    burn_space.serialize(&mut buffer)?;
    let space = buffer.len();

    // let lamports = Rent::get()?.minimum_balance(space);

    create_pda_account(
        user_account,                     // Payer for account creation
        &Rent::get()?,                    // Lamports for rent exemption
        space,                            // Size of the account
        token_program.key,                // Owner of the new account
        system_program,                   // System program for creating account
        burn_card_account,                // The account being created
        &[burn_seed.as_bytes(), &[bump]], // PDA seeds
    )?;

    // Initialize the burn card account
    invoke_signed(
        &token_instruction::initialize_account3(
            token_program.key,      // Token program ID
            burn_card_account.key,  // Account to initialize
            token_mint_account.key, // Mint of the token
            &burn_card_account_pda, // Authority of the account
        )?,
        &[
            burn_card_account.clone(),
            token_mint_account.clone(),
            burn_card_account.clone(),
            rent.clone(),
        ],
        &[&[burn_seed.as_bytes(), &[bump]]],
    )?;

    // Transfer tokens from user to burn account
    msg!("Transferring {} tokens to burn account", burn_amount);
    invoke(
        &token_instruction::transfer(
            token_program.key,      // Token program ID
            user_token_account.key, // User's token account (source)
            burn_card_account.key,  // Burn card account (destination)
            user_account.key,       // User's account (payer and authority)
            &[],                    // No additional signers
            burn_amount,            // Amount of tokens to transfer to burn account
        )?,
        &[
            user_token_account.clone(), // User's token account (source of tokens)
            burn_card_account.clone(),  // Burn card account (destination)
            user_account.clone(),       // User's account (authority)
            token_program.clone(),      // Token program for managing token operations
        ],
    )?;

    // Burn tokens
    msg!("Burning {} tokens", burn_amount);
    invoke_signed(
        &token_instruction::burn(
            token_program.key,      // Token program ID
            burn_card_account.key,  // Burn card account (from where the tokens are burned)
            &burn_card_account_pda, // PDA that has authority over the burn account
            user_account.key,       // User's account (authority for burn action)
            &[],                    // No additional signers
            burn_amount,            // Amount of tokens to burn
        )?,
        &[
            burn_card_account.clone(), // Burn card account (source of tokens to burn)
            burn_card_account.clone(), // PDA of the burn card account
            user_account.clone(),      // User's account (authority)
            token_program.clone(),     // Token program managing the burn operation
        ],
        &[&[burn_seed.as_bytes(), &[bump]]],
    )?;
    // Store burn data

    let burn_data = BurnCard {
        raid_program_id: raid_program_id.clone(),
        competition_id: competition_data.competition_id.clone(),
        user_id: *user_account.key,
        burn_amount,
        timestamp: Clock::get()?.unix_timestamp as u64,
    };
    burn_data.serialize(&mut &mut burn_card_account.data.borrow_mut()[..])?;

    msg!("Tokens burned successfully");
    Ok(())
}

fn create_raid(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    competition_type: String,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let current_competition_account = next_account_info(account_info_iter)?;
    let new_competition_account = next_account_info(account_info_iter)?;
    let raid_program_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_account = next_account_info(account_info_iter)?;
    let current_raid_card_account = next_account_info(account_info_iter)?;
    let new_raid_card_account = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify program ownership and update raid status if necessary
    let mut raid_program_data: RaidProgramCard =
        RaidProgramCard::try_from_slice(&raid_program_account.data.borrow())?;
    if raid_program_data.user_key != *user_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Handle competition creation or joining
    let (competition_account, is_new_competition, raid_card_account) = if competition_type == "PvP"
    {
        let challenged_program_account = next_account_info(account_info_iter)?;
        let challenged_program_data: RaidProgramCard =
            RaidProgramCard::try_from_slice(&challenged_program_account.data.borrow())?;

        if challenged_program_account.key == raid_program_account.key {
            return Err(ProgramError::InvalidAccountData);
        }

        // Get and update sequence number
        let mut token_account_card: TokenAccountCard =
            TokenAccountCard::try_from_slice(&token_account.data.borrow())?;
        let mut last_seen_raids: serde_json::Value =
            serde_json::from_str(&token_account_card.last_seen_raids)
                .map_err(|_| ProgramError::InvalidAccountData)?;

        let new_sequence = if let Some(seq) = last_seen_raids[&competition_type].as_u64() {
            seq + 1
        } else {
            1
        };

        last_seen_raids[&competition_type] = json!({
            "sequence": new_sequence,
            "competition_id": format!("{}_{}", competition_type, new_sequence)
        });

        token_account_card.last_seen_raids = serde_json::to_string(&last_seen_raids)
            .map_err(|_| ProgramError::InvalidAccountData)?;
        token_account_card.serialize(&mut &mut token_account.data.borrow_mut()[..])?;

        create_new_competition(
            program_id,
            &[
                user_account.clone(),
                system_program.clone(),
                new_competition_account.clone(),
            ],
            new_sequence,
            &competition_type,
            Some(raid_program_data.raid_program_id.clone()),
            Some(challenged_program_data.raid_program_id.clone()),
        )?;

        (new_competition_account, true, new_raid_card_account)
    } else {
        let competition_data: CompetitionCard =
            CompetitionCard::try_from_slice(&current_competition_account.data.borrow())?;

        if competition_data.status != "awaiting"
            || competition_data.enrolled_programs.split(',').count() as u64
                >= competition_data.required_programs
        {
            // Get and update sequence number
            let mut token_account_card: TokenAccountCard =
                TokenAccountCard::try_from_slice(&token_account.data.borrow())?;
            let mut last_seen_raids: serde_json::Value =
                serde_json::from_str(&token_account_card.last_seen_raids)
                    .map_err(|_| ProgramError::InvalidAccountData)?;

            let new_sequence = if let Some(seq) = last_seen_raids[&competition_type].as_u64() {
                seq + 1
            } else {
                1
            };

            last_seen_raids[&competition_type] = json!({
                "sequence": new_sequence,
                "competition_id": format!("{}_{}", competition_type, new_sequence)
            });

            token_account_card.last_seen_raids = serde_json::to_string(&last_seen_raids)
                .map_err(|_| ProgramError::InvalidAccountData)?;
            token_account_card.serialize(&mut &mut token_account.data.borrow_mut()[..])?;

            create_new_competition(
                program_id,
                &[
                    user_account.clone(),
                    system_program.clone(),
                    new_competition_account.clone(),
                ],
                new_sequence,
                &competition_type,
                None,
                None,
            )?;

            (new_competition_account, true, new_raid_card_account)
        } else {
            (
                current_competition_account,
                false,
                current_raid_card_account,
            )
        }
    };

    // Update competition data
    let mut competition_data: CompetitionCard =
        CompetitionCard::try_from_slice(&competition_account.data.borrow())?;
    competition_data
        .enrolled_programs
        .push_str(&format!("{},", raid_program_data.raid_program_id));

    if competition_data.enrolled_programs.split(',').count() as u64
        >= competition_data.required_programs
    {
        competition_data.status = "active".to_string();
        competition_data.start_time = Clock::get()?.unix_timestamp as u64 + 300; // 5 minutes from now
        competition_data.end_time = competition_data.start_time + 1200; // End in 20 minutes after start
    }

    competition_data.serialize(&mut &mut competition_account.data.borrow_mut()[..])?;

    // Create raid account
    let raid_seed = format!(
        "raid_{}_{}",
        competition_data.competition_id, raid_program_data.raid_program_id
    );
    let (raid_account_pda, bump) =
        Pubkey::find_program_address(&[raid_seed.as_bytes()], program_id);

    // Verify that the provided raid_card_account matches the derived PDA
    if raid_card_account.key != &raid_account_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    let raid_space = RaidCard {
        competition_id: competition_data.competition_id.clone(),
        raid_program_id: raid_program_data.raid_program_id.clone(),
        raid_id: format!(
            "{}_{}",
            competition_data.competition_id, raid_program_data.raid_program_id
        ),
    };
    let mut buffer = Vec::new();
    raid_space.serialize(&mut buffer)?;
    let space = buffer.len();

    create_pda_account(
        user_account,
        &Rent::get()?,
        space,
        program_id,
        system_program,
        raid_card_account,
        &[raid_seed.as_bytes(), &[bump]],
    )?;

    /*
        msg!("Initializing Raid Account...");
        invoke_signed(
            &token_instruction::initialize_account3(
                token_program.key,      // Token program ID
                raid_card_account.key,  // Account to initialize
                token_mint_account.key, // Mint of the token
                &raid_account_pda,      // Owner of the account
            )?,
            &[
                raid_card_account.clone(),
                token_mint_account.clone(),
                raid_card_account.clone(),
                rent.clone(),
            ],
            &[&[raid_seed.as_bytes(), &[bump]]],
        )?;
    */

    raid_space.serialize(&mut &mut raid_card_account.data.borrow_mut()[..])?;

    // Update raid program data
    raid_program_data.is_conducting_raid = true;
    raid_program_data.active_raid_id = raid_space.raid_id.clone();
    raid_program_data.serialize(&mut &mut raid_program_account.data.borrow_mut()[..])?;

    msg!("Raid created and competition updated successfully");
    Ok(())
}

fn create_new_competition<'a>(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'a>],
    sequence: u64,
    competition_type: &str,
    challenger_program_id: Option<String>,
    challenged_program_id: Option<String>,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let new_competition_account = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive PDA for new competition account
    let new_competition_seed = if competition_type == "PvP" {
        format!(
            "{}_{}_{}_{}",
            challenger_program_id.clone().unwrap(),
            competition_type,
            sequence,
            challenged_program_id.clone().unwrap()
        )
    } else {
        format!("{}_{}", competition_type, sequence)
    };
    let (new_competition_account_pda, bump) =
        Pubkey::find_program_address(&[new_competition_seed.as_bytes()], program_id);

    // Verify that the provided account matches the derived PDA
    if new_competition_account.key != &new_competition_account_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Create new competition account
    let new_competition_space = CompetitionCard {
        competition_id: new_competition_seed.clone(),
        competition_type: competition_type.to_string(),
        start_time: 0,
        end_time: 0,
        total_rewards_distributed: 0,
        status: "awaiting".to_string(),
        enrolled_programs: String::new(),
        required_programs: match competition_type {
            "4-program" => 4,
            "6-program" => 6,
            "12-program" => 12,
            "24-program" => 24,
            "PvP" => 2,
            _ => return Err(ProgramError::InvalidArgument),
        },
        challenger_program_id,
        challenged_program_id,
        start_expiration: if competition_type == "PvP" {
            Some(Clock::get()?.unix_timestamp as u64 + 300) // 5 minutes from now
        } else {
            None
        },
    };

    let mut buffer = Vec::new();
    new_competition_space.serialize(&mut buffer)?;
    let space = buffer.len();

    let rent = Rent::get()?;

    if new_competition_account.data_is_empty() {
        create_pda_account(
            user_account,
            &rent,
            space,
            program_id,
            system_program,
            new_competition_account,
            &[new_competition_seed.as_bytes(), &[bump]],
        )?;
    }

    /*
        msg!("Initializing account...");
        invoke_signed(
            &token_instruction::initialize_account3(
                token_program.key,
                new_competition_account.key,
                token_mint_account.key,
                &new_competition_account_pda,
            )?,
            &[
                new_competition_account.clone(),
                token_mint_account.clone(),
                new_competition_account.clone(),
                rent.clone(),
            ],
            &[&[new_competition_seed.as_bytes(), &[bump]]],
        )?;
    */

    // Serialize new competition data
    new_competition_space.serialize(&mut &mut new_competition_account.data.borrow_mut()[..])?;

    msg!("New competition created successfully");
    Ok(())
}

fn accept_pvp_challenge(accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let competition_account = next_account_info(account_info_iter)?;
    let challenged_program_account = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify program ownership
    let challenged_program_data: RaidProgramCard =
        RaidProgramCard::try_from_slice(&challenged_program_account.data.borrow())?;
    if challenged_program_data.user_key != *user_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Deserialize competition data
    let mut competition_data: CompetitionCard =
        CompetitionCard::try_from_slice(&competition_account.data.borrow())?;

    // Verify competition is awaiting acceptance
    if competition_data.status != "awaiting" {
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if the challenge has expired
    let current_time = Clock::get()?.unix_timestamp as u64;
    if current_time > competition_data.start_expiration.unwrap_or(0) {
        competition_data.status = "expired".to_string();
        competition_data.serialize(&mut &mut competition_account.data.borrow_mut()[..])?;
        return Err(ProgramError::InvalidAccountData);
    }

    // Update competition data
    competition_data.challenged_program_id = Some(challenged_program_data.raid_program_id.clone());
    competition_data.status = "active".to_string();
    competition_data.start_time = Clock::get()?.unix_timestamp as u64 + 300;
    competition_data.end_time = competition_data.start_time + 1200; // End in 20 minutes

    competition_data.serialize(&mut &mut competition_account.data.borrow_mut()[..])?;

    // Update challenged program data to indicate it is conducting a raid
    let mut challenged_program_data: RaidProgramCard =
        RaidProgramCard::try_from_slice(&challenged_program_account.data.borrow())?;
    challenged_program_data.is_conducting_raid = true;
    challenged_program_data
        .serialize(&mut &mut challenged_program_account.data.borrow_mut()[..])?;

    msg!("PvP challenge accepted and competition started successfully");
    Ok(())
}

fn check_raid_status(//accounts: &[AccountInfo],
    //raid_program_id: u64,
) -> ProgramResult {
    //let account_info_iter = &mut accounts.iter();
    //let raid_account = next_account_info(account_info_iter)?;

    // Deserialize raid data
    //let raid_data: RaidCard = RaidCard::try_from_slice(&raid_account.data.borrow())?;

    // Check if the raid has ended
    //let current_time = Clock::get()?.unix_timestamp as u64;

    msg!("Raid status checked successfully");
    Ok(())
}

fn enroll_in_program(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let raid_program_account = next_account_info(account_info_iter)?;
    let enrollment_card_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive PDA for enrollment account
    let enrollment_seed = format!("enrollment_{}_{}", program_id, user_account.key);
    let (enrollment_account_pda, bump) =
        Pubkey::find_program_address(&[enrollment_seed.as_bytes()], program_id);

    // Verify provided enrollment account matches derived PDA
    if enrollment_card_account.key != &enrollment_account_pda {
        msg!("Error: Enrollment account does not match derived PDA");
        return Err(ProgramError::InvalidAccountData);
    }

    let raid_program_data: RaidProgramCard =
        RaidProgramCard::try_from_slice(&raid_program_account.data.borrow())?;

    let enrollment_space = EnrollmentCard {
        raid_program_id: raid_program_data.raid_program_id.clone(),
        user_key: *user_account.key,
    };
    let mut buffer = Vec::new();
    enrollment_space.serialize(&mut buffer)?;
    let space = buffer.len();

    // let lamports = Rent::get()?.minimum_balance(space);

    create_pda_account(
        user_account,
        &Rent::get()?,
        space,
        program_id,
        system_program,
        enrollment_card_account,
        &[enrollment_seed.as_bytes(), &[bump]],
    )?;

    /*    msg!("Initializing account...");
        invoke_signed(
            &token_instruction::initialize_account3(
                token_program.key,
                enrollment_card_account.key,
                token_mint_account.key,
                &enrollment_account_pda,
            )?,
            &[
                enrollment_card_account.clone(),
                token_mint_account.clone(),
                enrollment_card_account.clone(),
                rent.clone(),
            ],
            &[&[enrollment_seed.as_bytes(), &[bump]]],
        )?;
    */

    // Serialize enrollment data
    let enrollment_data = EnrollmentCard {
        raid_program_id: raid_program_data.raid_program_id,
        user_key: *user_account.key,
    };
    enrollment_data.serialize(&mut &mut enrollment_card_account.data.borrow_mut()[..])?;

    msg!("Enrollment created successfully");
    Ok(())
}

fn authority_transfer(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let authority_account = next_account_info(account_info_iter)?;
    let program_token_account = next_account_info(account_info_iter)?;
    let token_mint = next_account_info(account_info_iter)?;
    let recipient_token_account = next_account_info(account_info_iter)?;
    let token_mint_pda_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    // Verify the authority
    if authority_account.key != &AUTHORITY_PUBKEY {
        return Err(ProgramError::InvalidAccountData);
    }

    // Ensure the authority is a signer
    if !authority_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive PDAs
    let (token_mint_pda, mint_bump) =
        Pubkey::find_program_address(&[b"pda_token_mint"], program_id);
    let (token_account_pda, _account_bump) =
        Pubkey::find_program_address(&[b"pda_token_account"], program_id);

    // Verify the token mint and program token account
    if token_mint.key != &token_mint_pda
        || program_token_account.key != &token_account_pda
        || token_mint_pda_account.key != &token_mint_pda
    {
        return Err(ProgramError::InvalidAccountData);
    }

    // Transfer tokens using transfer_checked
    invoke_signed(
        &token_instruction::transfer_checked(
            token_program.key,
            program_token_account.key,
            token_mint.key,
            recipient_token_account.key,
            token_mint_pda_account.key,
            &[&token_mint_pda],
            amount,
            9, // Assuming 9 decimals
        )?,
        &[
            program_token_account.clone(),
            token_mint.clone(),
            recipient_token_account.clone(),
            token_mint_pda_account.clone(),
            token_program.clone(),
        ],
        &[&[b"pda_token_mint", &[mint_bump]]],
    )?;

    msg!("Transferred {} tokens from program to recipient", amount);
    Ok(())
}
