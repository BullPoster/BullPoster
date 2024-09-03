use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
};
use spl_associated_token_account::tools::account::create_pda_account;
use spl_token::{
    instruction as token_instruction,
    state::{Account, Mint},
};

// Define your program ID
solana_program::declare_id!("Your_BullPoster_Program_ID");

// Constants
const AUTHORITY_PUBKEY: Pubkey = solana_program::pubkey!("AuthorityPublicKeyHere");
const TOTAL_SUPPLY: u64 = 1_000_000_000 * 1_000_000_000; // 1 billion tokens with 9 decimals
const REQUIRED_STAKE_AMOUNT: u64 = 1_000 * 1_000_000_000; // 1000 tokens with 9 decimals

// Instruction enum
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum BullPosterInstruction {
    InitializeProgram,
    CreateProgram { name: String },
    AuthorityTransfer { amount: u64 },
}

// Program entrypoint
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
        BullPosterInstruction::CreateProgram { name } => {
            msg!("Instruction: Create BullPoster Program");
            initialize_bullposter_stake_account(program_id, accounts, &name, REQUIRED_STAKE_AMOUNT)
        }
        BullPosterInstruction::AuthorityTransfer { amount } => {
            msg!("Instruction: Authority Transfer");
            authority_transfer(program_id, accounts, amount)
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
        initializer,
        &Rent::get()?,
        Mint::LEN,
        token_program.key,
        system_program,
        token_mint_account,
        &[b"pda_token_mint", &[mint_bump]],
    )?;

    // Initialize mint
    invoke_signed(
        &token_instruction::initialize_mint(
            token_program.key,
            &token_mint_pda,
            &token_mint_pda,
            Some(&token_mint_pda),
            9, // decimals
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
        Account::LEN,
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

    msg!("Token initialized and initial supply minted");
    Ok(())
}

pub fn initialize_bullposter_stake_account(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    program_name: &str,
    stake_amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let user_token_account = next_account_info(account_info_iter)?;
    let stake_account = next_account_info(account_info_iter)?;
    let token_mint_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent = next_account_info(account_info_iter)?;

    msg!(
        "Initializing BullPoster stake account for program: {}",
        program_name
    );

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive PDA for stake account
    let stake_seed = format!("stake_{}_{}", user_account.key, program_name);
    let (stake_account_pda, bump) =
        Pubkey::find_program_address(&[stake_seed.as_bytes()], program_id);

    // Verify provided stake account matches derived PDA
    if stake_account.key != &stake_account_pda {
        msg!("Error: Stake account does not match derived PDA");
        return Err(ProgramError::InvalidAccountData);
    }

    // Derive PDA for token mint
    let (token_mint_pda, _mint_bump) =
        Pubkey::find_program_address(&[b"pda_token_mint"], program_id);

    // Check if account already exists
    if !stake_account.data_is_empty() {
        msg!("Stake account is not empty");
        // Verify it's initialized correctly
        let token_account = Account::unpack(&stake_account.data.borrow())?;
        if token_account.mint != token_mint_pda || token_account.owner != stake_account_pda {
            msg!("Error: Existing stake account has invalid data");
            return Err(ProgramError::InvalidAccountData);
        }
        // Account exists and is initialized correctly, nothing more to do
        msg!("Existing stake account verified");
    } else {
        // Account doesn't exist, create and initialize it
        let space = Account::LEN;

        msg!("Creating PDA account...");
        create_pda_account(
            user_account,
            &Rent::get()?,
            space,
            token_program.key,
            system_program,
            stake_account,
            &[stake_seed.as_bytes(), &[bump]],
        )?;

        msg!("Initializing account...");
        invoke_signed(
            &token_instruction::initialize_account3(
                token_program.key,
                stake_account.key,
                token_mint_account.key,
                &stake_account_pda,
            )?,
            &[
                stake_account.clone(),
                token_mint_account.clone(),
                stake_account.clone(),
                rent.clone(),
            ],
            &[&[stake_seed.as_bytes(), &[bump]]],
        )?;
    }

    // Transfer tokens from user to stake account
    msg!("Transferring {} tokens to stake account", stake_amount);
    invoke(
        &token_instruction::transfer(
            token_program.key,
            user_token_account.key,
            stake_account.key,
            user_account.key,
            &[],
            stake_amount,
        )?,
        &[
            user_token_account.clone(),
            stake_account.clone(),
            user_account.clone(),
            token_program.clone(),
        ],
    )?;

    msg!("BullPoster stake account initialized successfully");
    msg!("Stake account: {:?}", stake_account.key);
    msg!("Staked amount: {}", stake_amount);

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
